-- Sentinela ML - internal observability (no external vendor, section 0.2).

create table public.internal_metrics (
  id bigint generated always as identity primary key,
  org_id uuid references public.organizations(id) on delete cascade,
  meli_account_id uuid references public.meli_accounts(id) on delete cascade,
  name text not null,
  value numeric not null,
  labels jsonb not null default '{}'::jsonb,
  recorded_at timestamptz not null default now()
);
create index internal_metrics_name_idx on public.internal_metrics(name, recorded_at desc);
create index internal_metrics_org_idx on public.internal_metrics(org_id, name, recorded_at desc)
  where org_id is not null;

alter table public.internal_metrics enable row level security;

create policy internal_metrics_read on public.internal_metrics
for select to authenticated using (
  org_id is not null and public.org_role_for(org_id) in ('owner','admin')
);

create or replace function public.backend_record_metric(
  p_name text,
  p_value numeric,
  p_org_id uuid default null,
  p_meli_account_id uuid default null,
  p_labels jsonb default '{}'::jsonb
)
returns void
language sql
security definer
set search_path = public, pg_temp
as $$
  insert into public.internal_metrics(org_id, meli_account_id, name, value, labels)
  values (p_org_id, p_meli_account_id, p_name, p_value, coalesce(p_labels,'{}'::jsonb));
$$;

revoke all on function public.backend_record_metric(text,numeric,uuid,uuid,jsonb)
  from public, anon, authenticated;
grant execute on function public.backend_record_metric(text,numeric,uuid,uuid,jsonb) to service_role;

-- Idempotency ledger for approved MercadoLibre writes (section 8.4).
create table public.action_executions (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id) on delete cascade,
  meli_account_id uuid not null references public.meli_accounts(id) on delete cascade,
  action_draft_id uuid not null references public.action_drafts(id) on delete cascade,
  idempotency_key text not null unique,
  attempt integer not null default 1,
  outcome text not null default 'started'
    check (outcome in ('started','executed','blocked_policy','failed')),
  http_status integer,
  error_class text,
  correlation_id uuid,
  started_at timestamptz not null default now(),
  finished_at timestamptz
);
create index action_executions_draft_idx on public.action_executions(action_draft_id, started_at desc);

alter table public.action_executions enable row level security;

create policy action_executions_read on public.action_executions
for select to authenticated using (public.is_org_member(org_id));

-- Per-account rate buckets and 429 feedback (section 3.1 / rule 10).
create or replace function public.backend_provision_rate_buckets(p_account_id uuid)
returns void
language sql
security definer
set search_path = private, public, pg_temp
as $$
  insert into private.meli_rate_buckets(bucket_key, capacity, tokens, refill_per_second)
  values
    ('account:' || p_account_id::text || ':default',   300, 300, 5),
    ('account:' || p_account_id::text || ':messaging', 250, 250, 4),
    ('account:' || p_account_id::text || ':oauth',      30,  30, 0.5),
    ('account:' || p_account_id::text || ':stock',      80,  80, 1.2)
  on conflict (bucket_key) do nothing;
$$;

create or replace function public.backend_penalize_rate_bucket(
  p_bucket_key text,
  p_blocked_ms integer default 30000
)
returns void
language plpgsql
security definer
set search_path = private, public, pg_temp
as $$
begin
  update private.meli_rate_buckets
  set blocked_until = greatest(coalesce(blocked_until, now()), now())
        + make_interval(secs => p_blocked_ms / 1000.0),
      -- Learn down on sustained 429s; never below 10% of the configured refill.
      learned_multiplier = greatest(0.1, learned_multiplier * 0.8),
      tokens = 0,
      updated_at = now()
  where bucket_key = p_bucket_key;
end;
$$;

-- Slow recovery of learned multipliers once 429 pressure stops.
create or replace function public.backend_relax_rate_buckets()
returns void
language sql
security definer
set search_path = private, public, pg_temp
as $$
  update private.meli_rate_buckets
  set learned_multiplier = least(1.0, learned_multiplier * 1.05), updated_at = now()
  where learned_multiplier < 1.0
    and (blocked_until is null or blocked_until < now() - interval '15 minutes');
$$;

revoke all on function public.backend_provision_rate_buckets(uuid) from public, anon, authenticated;
revoke all on function public.backend_penalize_rate_bucket(text,integer) from public, anon, authenticated;
revoke all on function public.backend_relax_rate_buckets() from public, anon, authenticated;
grant execute on function public.backend_provision_rate_buckets(uuid) to service_role;
grant execute on function public.backend_penalize_rate_bucket(text,integer) to service_role;
grant execute on function public.backend_relax_rate_buckets() to service_role;
