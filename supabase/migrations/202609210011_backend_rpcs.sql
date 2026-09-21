-- Sentinela ML - backend RPCs for OAuth linking, queueing and approvals.
-- All SECURITY DEFINER, all backend-only. The browser never calls these.

-- ---------- OAuth link attempts ----------
create or replace function public.backend_create_oauth_link_attempt(
  p_org_id uuid,
  p_user_id uuid,
  p_site_id text,
  p_state_hash text,
  p_redirect_uri text,
  p_code_verifier text default null,
  p_ttl_seconds integer default 600
)
returns uuid
language plpgsql
security definer
set search_path = private, public, vault, pg_temp
as $$
declare
  v_id uuid;
  v_secret_id uuid;
begin
  if p_code_verifier is not null then
    -- The PKCE verifier is a secret: it lives in Vault, never in a readable column.
    select vault.create_secret(
      p_code_verifier,
      'meli:pkce:' || gen_random_uuid()::text,
      'Sentinela PKCE verifier'
    ) into v_secret_id;
  end if;

  insert into private.oauth_link_attempts(
    org_id, user_id, site_id, state_hash, pkce_verifier_secret_id, redirect_uri, expires_at
  )
  values (
    p_org_id, p_user_id, p_site_id, decode(p_state_hash, 'hex'), v_secret_id, p_redirect_uri,
    now() + make_interval(secs => p_ttl_seconds)
  )
  returning id into v_id;

  return v_id;
end;
$$;

create or replace function public.backend_consume_oauth_link_attempt(p_state_hash text)
returns table(
  id uuid,
  org_id uuid,
  user_id uuid,
  site_id text,
  redirect_uri text,
  code_verifier text
)
language plpgsql
security definer
set search_path = private, public, vault, pg_temp
as $$
declare
  a private.oauth_link_attempts%rowtype;
  v_verifier text;
begin
  -- Single use: the update is the consumption, so a replayed callback finds nothing.
  update private.oauth_link_attempts
  set consumed_at = now()
  where state_hash = decode(p_state_hash, 'hex')
    and consumed_at is null
    and expires_at > now()
  returning * into a;

  if not found then
    return;
  end if;

  if a.pkce_verifier_secret_id is not null then
    select decrypted_secret into v_verifier
    from vault.decrypted_secrets where vault.decrypted_secrets.id = a.pkce_verifier_secret_id;
    perform vault.update_secret(a.pkce_verifier_secret_id, 'consumed');
  end if;

  return query select a.id, a.org_id, a.user_id, a.site_id, a.redirect_uri, v_verifier;
end;
$$;

-- ---------- Account linking ----------
create or replace function public.backend_link_meli_account(
  p_org_id uuid,
  p_user_id uuid,
  p_seller_id bigint,
  p_nickname text,
  p_site_id text,
  p_access_token text,
  p_refresh_token text,
  p_expires_at timestamptz,
  p_scope text[]
)
returns uuid
language plpgsql
security definer
set search_path = private, public, vault, pg_temp
as $$
declare
  v_account_id uuid;
  v_existing public.meli_accounts%rowtype;
  v_access_secret uuid;
  v_refresh_secret uuid;
begin
  select * into v_existing from public.meli_accounts where seller_id = p_seller_id;

  -- Step 10 of section 5.2: one seller cannot be live in two organizations.
  if found and v_existing.org_id <> p_org_id and v_existing.status <> 'disconnected' then
    raise exception 'seller_already_linked';
  end if;

  if found then
    update public.meli_accounts
    set org_id = p_org_id,
        nickname = coalesce(p_nickname, nickname),
        site_id = p_site_id,
        status = 'backfilling',
        status_reason = null,
        linked_by = p_user_id,
        linked_at = now(),
        updated_at = now()
    where id = v_existing.id
    returning id into v_account_id;
  else
    insert into public.meli_accounts(org_id, seller_id, site_id, nickname, status, linked_by)
    values (p_org_id, p_seller_id, p_site_id, p_nickname, 'backfilling', p_user_id)
    returning id into v_account_id;
  end if;

  -- Two Vault secrets per account, created once and updated on every refresh.
  if exists (select 1 from private.meli_oauth_credentials where meli_account_id = v_account_id) then
    select access_secret_id, refresh_secret_id into v_access_secret, v_refresh_secret
    from private.meli_oauth_credentials where meli_account_id = v_account_id;

    perform vault.update_secret(v_access_secret, p_access_token);
    perform vault.update_secret(v_refresh_secret, p_refresh_token);

    update private.meli_oauth_credentials
    set expires_at = p_expires_at,
        scope = p_scope,
        credential_version = credential_version + 1,
        refresh_lease_owner = null,
        refresh_lease_until = null,
        last_error_code = null,
        last_error_at = null,
        updated_at = now()
    where meli_account_id = v_account_id;
  else
    select vault.create_secret(p_access_token, 'meli:' || v_account_id::text || ':access', 'Sentinela access token')
      into v_access_secret;
    select vault.create_secret(p_refresh_token, 'meli:' || v_account_id::text || ':refresh', 'Sentinela refresh token')
      into v_refresh_secret;

    insert into private.meli_oauth_credentials(
      meli_account_id, access_secret_id, refresh_secret_id, expires_at, scope
    )
    values (v_account_id, v_access_secret, v_refresh_secret, p_expires_at, p_scope);
  end if;

  insert into public.security_audit_log(org_id, actor_user_id, meli_account_id, action, resource_type, resource_id, metadata)
  values (p_org_id, p_user_id, v_account_id, 'oauth_linked', 'meli_account', v_account_id::text,
          jsonb_build_object('site_id', p_site_id, 'scope', p_scope));

  return v_account_id;
end;
$$;

create or replace function public.backend_disconnect_meli_account(
  p_account_id uuid,
  p_org_id uuid,
  p_actor uuid
)
returns void
language plpgsql
security definer
set search_path = private, public, pg_temp
as $$
begin
  update public.meli_accounts
  set status = 'disconnected', status_reason = 'disconnected_by_user', updated_at = now()
  where id = p_account_id and org_id = p_org_id;

  if not found then
    raise exception 'account_not_found';
  end if;

  -- Stop every pending job; retention decides when the data goes.
  update public.sync_jobs
  set status = 'cancelled', updated_at = now()
  where meli_account_id = p_account_id and status in ('queued','running','paused');

  insert into public.security_audit_log(org_id, actor_user_id, meli_account_id, action, resource_type, resource_id)
  values (p_org_id, p_actor, p_account_id, 'oauth_disconnected', 'meli_account', p_account_id::text);
end;
$$;

-- ---------- Bootstrap / backfill enqueue ----------
create or replace function public.backend_enqueue_bootstrap(p_account_id uuid)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_org uuid;
  v_kind text;
begin
  select org_id into v_org from public.meli_accounts where id = p_account_id;
  if v_org is null then
    raise exception 'account_not_found';
  end if;

  -- 365 days covers the low-volume reputation window; orders are documented
  -- as available for roughly 12 months, which is enough to bootstrap the twin.
  foreach v_kind in array array['orders','claims','items','shipments','messages','questions'] loop
    insert into public.sync_jobs(org_id, meli_account_id, kind, resource_kind, range_start, range_end, priority)
    values (v_org, p_account_id, 'historical_bootstrap', v_kind, now() - interval '365 days', now(),
            case v_kind when 'orders' then 10 when 'claims' then 20 else 50 end);
  end loop;
end;
$$;

-- ---------- Action approval ----------
create or replace function public.backend_approve_action(
  p_action_id uuid,
  p_org_id uuid,
  p_actor uuid
)
returns public.action_status
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_status public.action_status;
begin
  -- Only a draft awaiting approval can be approved, and only once.
  update public.action_drafts
  set status = 'approved',
      approved_by = p_actor,
      approved_at = now(),
      updated_at = now()
  where id = p_action_id
    and org_id = p_org_id
    and status in ('draft','pending_approval')
  returning status into v_status;

  if not found then
    raise exception 'action_not_approvable';
  end if;

  insert into public.security_audit_log(org_id, actor_user_id, action, resource_type, resource_id)
  values (p_org_id, p_actor, 'action_approved', 'action_draft', p_action_id::text);

  return v_status;
end;
$$;

create or replace function public.backend_cancel_action(
  p_action_id uuid,
  p_org_id uuid,
  p_actor uuid
)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  update public.action_drafts
  set status = 'cancelled', updated_at = now()
  where id = p_action_id
    and org_id = p_org_id
    and status in ('draft','pending_approval','approved');

  if not found then
    raise exception 'action_not_cancellable';
  end if;

  insert into public.security_audit_log(org_id, actor_user_id, action, resource_type, resource_id)
  values (p_org_id, p_actor, 'action_cancelled', 'action_draft', p_action_id::text);
end;
$$;

create or replace function public.backend_acknowledge_alert(
  p_alert_id uuid,
  p_org_id uuid,
  p_actor uuid
)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  update public.alerts
  set status = 'acknowledged', acknowledged_by = p_actor, acknowledged_at = now()
  where id = p_alert_id and org_id = p_org_id and status = 'open';

  if not found then
    raise exception 'alert_not_open';
  end if;
end;
$$;

-- ---------- Manual reconciliation ----------
create or replace function public.backend_request_reconcile(
  p_account_id uuid,
  p_org_id uuid,
  p_actor uuid,
  p_resource_kind text default 'reputation'
)
returns uuid
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_job uuid;
begin
  insert into public.sync_jobs(org_id, meli_account_id, kind, resource_kind, priority, range_start, range_end)
  select p_org_id, p_account_id, 'manual_reconcile', p_resource_kind, 5, now() - interval '7 days', now()
  where exists (select 1 from public.meli_accounts where id = p_account_id and org_id = p_org_id)
  returning id into v_job;

  if v_job is null then
    raise exception 'account_not_found';
  end if;

  insert into public.security_audit_log(org_id, actor_user_id, meli_account_id, action, resource_type, resource_id)
  values (p_org_id, p_actor, 'manual_reconcile_requested', 'sync_job', v_job::text);

  return v_job;
end;
$$;

-- ---------- Webhook ingress (single transaction, no external calls) ----------
create or replace function public.backend_ingest_webhook(
  p_event_key text,
  p_topic text,
  p_resource text,
  p_user_id bigint,
  p_application_id bigint,
  p_meli_account_id uuid,
  p_org_id uuid,
  p_sent_at timestamptz,
  p_attempts integer,
  p_actions text[]
)
returns boolean
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_inserted boolean := false;
  v_event_id uuid;
begin
  insert into public.webhook_dedupe(event_key)
  values (p_event_key)
  on conflict (event_key) do nothing;

  get diagnostics v_inserted = row_count;
  if not v_inserted then
    return false;
  end if;

  insert into public.webhook_events(
    org_id, meli_account_id, event_key, topic, resource, user_id,
    application_id, sent_at, attempts, actions
  )
  values (
    p_org_id, p_meli_account_id, p_event_key, p_topic, p_resource, p_user_id,
    p_application_id, p_sent_at, p_attempts, to_jsonb(coalesce(p_actions, '{}'::text[]))
  )
  returning id into v_event_id;

  -- Compact envelope only: the worker fetches the authoritative resource itself.
  perform pgmq.send('meli_events', jsonb_build_object(
    'event_id', v_event_id,
    'event_key', p_event_key,
    'topic', p_topic,
    'resource', p_resource,
    'meli_account_id', p_meli_account_id,
    'org_id', p_org_id
  ));

  return true;
end;
$$;

revoke all on function public.backend_create_oauth_link_attempt(uuid,uuid,text,text,text,text,integer) from public, anon, authenticated;
revoke all on function public.backend_consume_oauth_link_attempt(text) from public, anon, authenticated;
revoke all on function public.backend_link_meli_account(uuid,uuid,bigint,text,text,text,text,timestamptz,text[]) from public, anon, authenticated;
revoke all on function public.backend_disconnect_meli_account(uuid,uuid,uuid) from public, anon, authenticated;
revoke all on function public.backend_enqueue_bootstrap(uuid) from public, anon, authenticated;
revoke all on function public.backend_approve_action(uuid,uuid,uuid) from public, anon, authenticated;
revoke all on function public.backend_cancel_action(uuid,uuid,uuid) from public, anon, authenticated;
revoke all on function public.backend_acknowledge_alert(uuid,uuid,uuid) from public, anon, authenticated;
revoke all on function public.backend_request_reconcile(uuid,uuid,uuid,text) from public, anon, authenticated;
revoke all on function public.backend_ingest_webhook(text,text,text,bigint,bigint,uuid,uuid,timestamptz,integer,text[]) from public, anon, authenticated;

grant execute on function public.backend_create_oauth_link_attempt(uuid,uuid,text,text,text,text,integer) to service_role;
grant execute on function public.backend_consume_oauth_link_attempt(text) to service_role;
grant execute on function public.backend_link_meli_account(uuid,uuid,bigint,text,text,text,text,timestamptz,text[]) to service_role;
grant execute on function public.backend_disconnect_meli_account(uuid,uuid,uuid) to service_role;
grant execute on function public.backend_enqueue_bootstrap(uuid) to service_role;
grant execute on function public.backend_approve_action(uuid,uuid,uuid) to service_role;
grant execute on function public.backend_cancel_action(uuid,uuid,uuid) to service_role;
grant execute on function public.backend_acknowledge_alert(uuid,uuid,uuid) to service_role;
grant execute on function public.backend_request_reconcile(uuid,uuid,uuid,text) to service_role;
grant execute on function public.backend_ingest_webhook(text,text,text,bigint,bigint,uuid,uuid,timestamptz,integer,text[]) to service_role;

-- ---------- Action execution enqueue ----------
create or replace function public.backend_enqueue_action_execution(
  p_action_id uuid,
  p_org_id uuid,
  p_actor uuid,
  p_correlation_id uuid default null
)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  d public.action_drafts%rowtype;
begin
  select * into d from public.action_drafts
  where id = p_action_id and org_id = p_org_id and status = 'approved'
  for update;

  if not found then
    raise exception 'action_not_approved';
  end if;

  update public.action_drafts set status = 'executing', updated_at = now() where id = p_action_id;

  perform pgmq.send('derived_jobs', jsonb_build_object(
    'job', 'execute_approved_action',
    'action_draft_id', p_action_id,
    'org_id', p_org_id,
    'meli_account_id', d.meli_account_id,
    'correlation_id', p_correlation_id
  ));

  insert into public.security_audit_log(org_id, actor_user_id, meli_account_id, action, resource_type, resource_id, correlation_id)
  values (p_org_id, p_actor, d.meli_account_id, 'action_execution_enqueued', 'action_draft', p_action_id::text, p_correlation_id);
end;
$$;

revoke all on function public.backend_enqueue_action_execution(uuid,uuid,uuid,uuid) from public, anon, authenticated;
grant execute on function public.backend_enqueue_action_execution(uuid,uuid,uuid,uuid) to service_role;
