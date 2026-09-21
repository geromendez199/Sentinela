-- Sentinela ML - baseline schema (Master Build Specification v1.0)
-- Target: Supabase Postgres (2026)

-- ---------- private rate budgets ----------
create table private.meli_rate_buckets (
  bucket_key text primary key,
  capacity numeric not null check (capacity > 0),
  tokens numeric not null check (tokens >= 0),
  refill_per_second numeric not null check (refill_per_second > 0),
  updated_at timestamptz not null default now(),
  blocked_until timestamptz,
  learned_multiplier numeric not null default 1.0 check (learned_multiplier > 0 and learned_multiplier <= 1.0)
);
create or replace function public.backend_take_rate_token(p_bucket_key text, p_cost numeric default 1)
returns table(granted boolean, wait_ms integer, tokens_remaining numeric)
language plpgsql
security definer
set search_path = private, public, pg_temp
as $$
declare
  b private.meli_rate_buckets%rowtype;
  v_now timestamptz := now();
  v_refilled numeric;
  v_effective_refill numeric;
  v_wait numeric;
begin
  select * into b from private.meli_rate_buckets where bucket_key=p_bucket_key for update;
  if not found then
    raise exception 'unknown_rate_bucket:%', p_bucket_key;
  end if;
  if b.blocked_until is not null and b.blocked_until > v_now then
    return query select false,
      ceil(extract(epoch from (b.blocked_until-v_now))*1000)::integer,
      b.tokens;
    return;
  end if;
  v_effective_refill := b.refill_per_second * b.learned_multiplier;
  v_refilled := least(b.capacity,
    b.tokens + extract(epoch from (v_now-b.updated_at))*v_effective_refill);
  if v_refilled >= p_cost then
    update private.meli_rate_buckets
      set tokens=v_refilled-p_cost, updated_at=v_now
      where bucket_key=p_bucket_key;
    return query select true, 0, v_refilled-p_cost;
  else
    v_wait := (p_cost-v_refilled)/v_effective_refill;
    update private.meli_rate_buckets set tokens=v_refilled, updated_at=v_now where bucket_key=p_bucket_key;
    return query select false, ceil(v_wait*1000)::integer, v_refilled;
  end if;
end;
$$;
-- ---------- OAuth Vault RPCs ----------
create or replace function public.backend_get_oauth_material(p_account_id uuid)
returns table(
  access_token text,
  refresh_token text,
  expires_at timestamptz,
  credential_version bigint,
  refresh_lease_owner uuid,
  refresh_lease_until timestamptz,
  account_status public.meli_account_status
)
language sql
security definer
set search_path = private, public, vault, pg_temp
as $$
  select a.decrypted_secret,
         r.decrypted_secret,
         c.expires_at,
         c.credential_version,
         c.refresh_lease_owner,
         c.refresh_lease_until,
         ma.status
  from private.meli_oauth_credentials c
  join public.meli_accounts ma on ma.id=c.meli_account_id
  join vault.decrypted_secrets a on a.id=c.access_secret_id
  join vault.decrypted_secrets r on r.id=c.refresh_secret_id
  where c.meli_account_id=p_account_id;
$$;
create or replace function public.backend_acquire_refresh_lease(
  p_account_id uuid,
  p_owner uuid,
  p_expected_version bigint,
  p_lease_seconds integer default 30
)
returns boolean
language plpgsql
security definer
set search_path = private, public, pg_temp
as $$
declare v_count int;
begin
  update private.meli_oauth_credentials
  set refresh_lease_owner=p_owner,
      refresh_lease_until=now() + make_interval(secs => p_lease_seconds),
      updated_at=now()
  where meli_account_id=p_account_id
    and credential_version=p_expected_version
    and (refresh_lease_until is null or refresh_lease_until < now());
  get diagnostics v_count = row_count;
  return v_count=1;
end;
$$;
create or replace function public.backend_commit_refresh(
  p_account_id uuid,
  p_owner uuid,
  p_expected_version bigint,
  p_access_token text,
  p_refresh_token text,
  p_expires_at timestamptz,
  p_scope text[]
)
returns bigint
language plpgsql
security definer
set search_path = private, public, vault, pg_temp
as $$
declare
  c private.meli_oauth_credentials%rowtype;
  v_new_version bigint;
begin
  select * into c from private.meli_oauth_credentials
    where meli_account_id=p_account_id for update;
  if c.credential_version <> p_expected_version then
    raise exception 'credential_version_conflict';
  end if;
  if c.refresh_lease_owner is distinct from p_owner or c.refresh_lease_until < now() then
    raise exception 'refresh_lease_not_owned';
  end if;
  perform vault.update_secret(c.access_secret_id, p_access_token,
    'meli:'||p_account_id::text||':access', 'MercadoLibre access token');
  perform vault.update_secret(c.refresh_secret_id, p_refresh_token,
    'meli:'||p_account_id::text||':refresh', 'MercadoLibre rotating refresh token');
  update private.meli_oauth_credentials
  set expires_at=p_expires_at,
      scope=coalesce(p_scope,'{}'::text[]),
      credential_version=credential_version+1,
      refresh_lease_owner=null,
      refresh_lease_until=null,
      last_refresh_at=now(),
      last_error_code=null,
      last_error_at=null,
      updated_at=now()
  where meli_account_id=p_account_id
  returning credential_version into v_new_version;
  return v_new_version;
end;
$$;
create or replace function public.backend_release_refresh_lease(p_account_id uuid, p_owner uuid)
returns void
language sql
security definer
set search_path = private, pg_temp
as $$
  update private.meli_oauth_credentials
  set refresh_lease_owner=null, refresh_lease_until=null, updated_at=now()
  where meli_account_id=p_account_id and refresh_lease_owner=p_owner;
$$;
-- ---------- partition helper ----------
create or replace function public.backend_create_webhook_partition(p_month date)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_start date := date_trunc('month', p_month)::date;
  v_end date := (date_trunc('month', p_month) + interval '1 month')::date;
  v_name text := 'webhook_events_' || to_char(v_start,'YYYY_MM');
begin
  execute format(
    'create table if not exists public.%I partition of public.webhook_events for values from (%L) to (%L)',
    v_name, v_start, v_end
  );
end;
$$;
select public.backend_create_webhook_partition(current_date);
select public.backend_create_webhook_partition((current_date + interval '1 month')::date);
select public.backend_create_webhook_partition((current_date + interval '2 months')::date);
-- ---------- triggers ----------
create trigger organizations_updated_at before update on public.organizations
for each row execute function public.set_updated_at();
create trigger organization_members_updated_at before update on public.organization_members
for each row execute function public.set_updated_at();
create trigger meli_accounts_updated_at before update on public.meli_accounts
for each row execute function public.set_updated_at();
create trigger sync_jobs_updated_at before update on public.sync_jobs
for each row execute function public.set_updated_at();
create trigger playbook_rules_updated_at before update on public.playbook_rules
for each row execute function public.set_updated_at();
create trigger action_drafts_updated_at before update on public.action_drafts
for each row execute function public.set_updated_at();
create trigger root_cause_clusters_updated_at before update on public.root_cause_clusters
for each row execute function public.set_updated_at();
-- ---------- RLS ----------
alter table public.organizations enable row level security;
alter table public.organization_members enable row level security;
alter table public.meli_accounts enable row level security;
alter table public.security_audit_log enable row level security;
alter table public.webhook_events enable row level security;
alter table public.sync_jobs enable row level security;
alter table public.sync_checkpoints enable row level security;
alter table public.packs enable row level security;
alter table public.orders enable row level security;
alter table public.order_items enable row level security;
alter table public.shipments enable row level security;
alter table public.shipment_status_history enable row level security;
alter table public.items enable row level security;
alter table public.user_product_stock enable row level security;
alter table public.questions enable row level security;
alter table public.messages enable row level security;
alter table public.claims enable row level security;
alter table public.claim_messages enable row level security;
alter table public.returns enable row level security;
alter table public.reputation_snapshots enable row level security;
alter table public.reputation_incidents enable row level security;
alter table public.reputation_computations enable row level security;
alter table public.risk_model_versions enable row level security;
alter table public.risk_scores enable row level security;
alter table public.risk_score_features enable row level security;
alter table public.ai_classifications enable row level security;
alter table public.root_cause_documents enable row level security;
alter table public.root_cause_clusters enable row level security;
alter table public.listing_suggestions enable row level security;
alter table public.playbook_rules enable row level security;
alter table public.action_drafts enable row level security;
alter table public.alerts enable row level security;
alter table public.retention_policies enable row level security;
alter table public.data_subject_requests enable row level security;
-- Global reference tables claim_reasons and reputation_rule_sets are intentionally read-only
-- to authenticated users and contain no tenant secrets.
alter table public.claim_reasons enable row level security;
alter table public.reputation_rule_sets enable row level security;
create policy claim_reasons_read on public.claim_reasons for select to authenticated using (true);
create policy reputation_rule_sets_read on public.reputation_rule_sets for select to authenticated using (true);
-- Org root tables.
create policy organizations_read on public.organizations
for select to authenticated using (public.is_org_member(id));
create policy organizations_update on public.organizations
for update to authenticated
using (public.org_role_for(id) in ('owner','admin'))
with check (public.org_role_for(id) in ('owner','admin'));
create policy organization_members_read on public.organization_members
for select to authenticated using (public.is_org_member(org_id));
-- Membership mutation is deliberately owner-only in baseline; admin delegation can be added
-- through an audited RPC with explicit constraints, not unrestricted table writes.
create policy organization_members_insert on public.organization_members
for insert to authenticated with check (public.org_role_for(org_id)='owner');
create policy organization_members_update on public.organization_members
for update to authenticated
using (public.org_role_for(org_id)='owner')
with check (public.org_role_for(org_id)='owner');
create policy organization_members_delete on public.organization_members
for delete to authenticated using (public.org_role_for(org_id)='owner');
-- Generic tenant READ policies for current-state/derived tables.
do $$
declare t text;
begin
  foreach t in array array[
    'meli_accounts','webhook_events','sync_jobs','sync_checkpoints','packs','orders','order_items',
    'shipments','shipment_status_history','items','user_product_stock','questions','messages','claims',
    'claim_messages','returns','reputation_snapshots','reputation_incidents','reputation_computations',
    'risk_scores','ai_classifications','root_cause_documents','root_cause_clusters','listing_suggestions',
    'action_drafts','alerts','retention_policies','data_subject_requests'
  ] loop
    execute format('create policy %I on public.%I for select to authenticated using (public.is_org_member(org_id))',
      t||'_tenant_read', t);
  end loop;
end $$;
-- risk_score_features has no org_id; authorize through parent risk_score.
create policy risk_score_features_read on public.risk_score_features
for select to authenticated using (
  exists (select 1 from public.risk_scores rs
          where rs.id=risk_score_id and public.is_org_member(rs.org_id))
);
-- risk_model_versions can be global (org_id null) or tenant-specific.
create policy risk_model_versions_read on public.risk_model_versions
for select to authenticated using (org_id is null or public.is_org_member(org_id));
-- Audit is more sensitive: only owner/admin.
create policy security_audit_read on public.security_audit_log
for select to authenticated using (
  org_id is not null and public.org_role_for(org_id) in ('owner','admin')
);
-- Client-writable configuration: playbook rules and retention policy only for owner/admin.
create policy playbook_rules_read on public.playbook_rules
for select to authenticated using (public.is_org_member(org_id));
create policy playbook_rules_insert on public.playbook_rules
for insert to authenticated with check (public.org_role_for(org_id) in ('owner','admin') and created_by=auth.uid());
create policy playbook_rules_update on public.playbook_rules
for update to authenticated
using (public.org_role_for(org_id) in ('owner','admin'))
with check (public.org_role_for(org_id) in ('owner','admin'));
create policy playbook_rules_delete on public.playbook_rules
for delete to authenticated using (public.org_role_for(org_id) in ('owner','admin'));
create policy retention_policies_insert on public.retention_policies
for insert to authenticated with check (public.org_role_for(org_id) in ('owner','admin'));
create policy retention_policies_update on public.retention_policies
for update to authenticated
using (public.org_role_for(org_id) in ('owner','admin'))
with check (public.org_role_for(org_id) in ('owner','admin'));
-- NOTE: meli_accounts, state mirrors, action_drafts approvals/execution, alerts ACK,
-- suggestions and derived data have NO client write policies in baseline.
-- Mutations go through server routes/Edge Functions with backend secret and audit.
-- Private schemas/tokens must not be reachable by browser roles.
revoke all on schema private from public, anon, authenticated;
revoke all on all tables in schema private from public, anon, authenticated;
revoke all on all sequences in schema private from public, anon, authenticated;
revoke all on vault.secrets from anon, authenticated;
revoke all on vault.decrypted_secrets from anon, authenticated;
-- Backend-only RPCs.
revoke all on function public.backend_take_rate_token(text,numeric) from public, anon, authenticated;
revoke all on function public.backend_get_oauth_material(uuid) from public, anon, authenticated;
revoke all on function public.backend_acquire_refresh_lease(uuid,uuid,bigint,integer) from public, anon, authenticated;
revoke all on function public.backend_commit_refresh(uuid,uuid,bigint,text,text,timestamptz,text[]) from public, anon, 
authenticated;
revoke all on function public.backend_release_refresh_lease(uuid,uuid) from public, anon, authenticated;
revoke all on function public.backend_create_webhook_partition(date) from public, anon, authenticated;
grant execute on function public.backend_take_rate_token(text,numeric) to service_role;
grant execute on function public.backend_get_oauth_material(uuid) to service_role;
grant execute on function public.backend_acquire_refresh_lease(uuid,uuid,bigint,integer) to service_role;
grant execute on function public.backend_commit_refresh(uuid,uuid,bigint,text,text,timestamptz,text[]) to service_role;
grant execute on function public.backend_release_refresh_lease(uuid,uuid) to service_role;
grant execute on function public.backend_create_webhook_partition(date) to service_role;
-- Initialize durable queue. Ignore duplicate creation in an idempotent migration wrapper if needed.
select pgmq.create('meli_events');
select pgmq.create('derived_jobs');
select pgmq.create('outbound_alerts');
-- Realtime: publish only tables needed by dashboard; avoid raw webhook firehose.
alter publication supabase_realtime add table public.meli_accounts;
alter publication supabase_realtime add table public.reputation_snapshots;
alter publication supabase_realtime add table public.reputation_computations;
alter publication supabase_realtime add table public.risk_scores;
alter publication supabase_realtime add table public.action_drafts;
alter publication supabase_realtime add table public.alerts;

-- ---------- views ----------
create view public.latest_reputation as
select distinct on (meli_account_id)
  org_id, meli_account_id, observed_at, level_id, power_seller_status,
  claims_rate, cancellations_rate, delay_rate, sales_completed
from public.reputation_snapshots
order by meli_account_id, observed_at desc;
create view public.latest_risk_per_order as
select distinct on (meli_account_id, order_id)
  org_id, meli_account_id, order_id, pack_id, computed_at,
  risk_probability, claim_risk, cancellation_risk, delay_risk, risk_band, explanations
from public.risk_scores
where order_id is not null
order by meli_account_id, order_id, computed_at desc;
create view public.open_operational_risk as
select r.*, o.status, o.date_created, s.expected_dispatch_at, s.sla_status
from public.latest_risk_per_order r
join public.orders o using (meli_account_id, order_id)
left join public.shipments s on s.meli_account_id=o.meli_account_id and s.shipment_id=o.shipment_id
where o.status not in ('cancelled','closed') and r.risk_band in ('high','critical');
