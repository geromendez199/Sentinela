-- A6 QA fix: preserve rotated MercadoLibre refresh results durably in Vault before
-- replacing the canonical credential pair. A successful /oauth/token response must
-- never be lost merely because the canonical commit RPC response/transaction fails.

create table private.meli_refresh_recovery (
  meli_account_id uuid primary key references public.meli_accounts(id) on delete cascade,
  access_secret_id uuid not null,
  refresh_secret_id uuid not null,
  expected_credential_version bigint,
  expires_at timestamptz,
  scope text[] not null default '{}'::text[],
  staged_at timestamptz,
  consumed_at timestamptz,
  updated_at timestamptz not null default now()
);

revoke all on table private.meli_refresh_recovery from public, anon, authenticated;

create or replace function public.backend_stage_refresh_recovery(
  p_account_id uuid,
  p_owner uuid,
  p_expected_version bigint,
  p_access_token text,
  p_refresh_token text,
  p_expires_at timestamptz,
  p_scope text[]
)
returns boolean
language plpgsql
security definer
set search_path = private, public, vault, pg_temp
as $$
declare
  c private.meli_oauth_credentials%rowtype;
  r private.meli_refresh_recovery%rowtype;
  v_access_secret uuid;
  v_refresh_secret uuid;
begin
  select * into c
  from private.meli_oauth_credentials
  where meli_account_id = p_account_id
  for update;

  if not found then raise exception 'credentials_missing'; end if;
  if c.credential_version <> p_expected_version then
    raise exception 'credential_version_conflict';
  end if;
  if c.refresh_lease_owner is distinct from p_owner
     or c.refresh_lease_until is null
     or c.refresh_lease_until < now() then
    raise exception 'refresh_lease_not_owned';
  end if;

  select * into r
  from private.meli_refresh_recovery
  where meli_account_id = p_account_id
  for update;

  if not found then
    select vault.create_secret(
      p_access_token,
      'meli:' || p_account_id::text || ':recovery_access',
      'Sentinela staged MercadoLibre access token'
    ) into v_access_secret;
    select vault.create_secret(
      p_refresh_token,
      'meli:' || p_account_id::text || ':recovery_refresh',
      'Sentinela staged MercadoLibre rotating refresh token'
    ) into v_refresh_secret;

    insert into private.meli_refresh_recovery(
      meli_account_id, access_secret_id, refresh_secret_id,
      expected_credential_version, expires_at, scope, staged_at, consumed_at
    ) values (
      p_account_id, v_access_secret, v_refresh_secret,
      p_expected_version, p_expires_at, coalesce(p_scope, '{}'::text[]), now(), null
    );
  else
    perform vault.update_secret(r.access_secret_id, p_access_token);
    perform vault.update_secret(r.refresh_secret_id, p_refresh_token);

    update private.meli_refresh_recovery
    set expected_credential_version = p_expected_version,
        expires_at = p_expires_at,
        scope = coalesce(p_scope, '{}'::text[]),
        staged_at = now(),
        consumed_at = null,
        updated_at = now()
    where meli_account_id = p_account_id;
  end if;

  insert into public.security_audit_log(
    org_id, meli_account_id, action, resource_type, resource_id, metadata
  )
  select ma.org_id, ma.id, 'oauth_refresh_staged', 'meli_account', ma.id::text,
         jsonb_build_object('credential_version', p_expected_version)
  from public.meli_accounts ma
  where ma.id = p_account_id;

  return true;
end;
$$;

create or replace function public.backend_commit_staged_refresh(
  p_account_id uuid,
  p_owner uuid,
  p_expected_version bigint
)
returns table(access_token text, credential_version bigint)
language plpgsql
security definer
set search_path = private, public, vault, pg_temp
as $$
declare
  c private.meli_oauth_credentials%rowtype;
  r private.meli_refresh_recovery%rowtype;
  v_access text;
  v_refresh text;
  v_new_version bigint;
begin
  select * into c
  from private.meli_oauth_credentials
  where meli_account_id = p_account_id
  for update;

  if not found then raise exception 'credentials_missing'; end if;
  if c.credential_version <> p_expected_version then
    raise exception 'credential_version_conflict';
  end if;
  if c.refresh_lease_owner is distinct from p_owner
     or c.refresh_lease_until is null
     or c.refresh_lease_until < now() then
    raise exception 'refresh_lease_not_owned';
  end if;

  select * into r
  from private.meli_refresh_recovery
  where meli_account_id = p_account_id
    and expected_credential_version = p_expected_version
    and staged_at is not null
    and consumed_at is null
  for update;

  if not found then
    return;
  end if;

  select decrypted_secret into v_access
  from vault.decrypted_secrets
  where id = r.access_secret_id;
  select decrypted_secret into v_refresh
  from vault.decrypted_secrets
  where id = r.refresh_secret_id;

  if v_access is null or v_refresh is null then
    raise exception 'refresh_recovery_secret_missing';
  end if;

  perform vault.update_secret(c.access_secret_id, v_access);
  perform vault.update_secret(c.refresh_secret_id, v_refresh);

  update private.meli_oauth_credentials
  set expires_at = r.expires_at,
      scope = coalesce(r.scope, '{}'::text[]),
      credential_version = c.credential_version + 1,
      refresh_lease_owner = null,
      refresh_lease_until = null,
      last_refresh_at = now(),
      last_error_code = null,
      last_error_at = null,
      updated_at = now()
  where meli_account_id = p_account_id
  returning private.meli_oauth_credentials.credential_version into v_new_version;

  -- Keep reusable recovery slots but destroy the rotated token material after commit.
  perform vault.update_secret(r.access_secret_id, 'consumed');
  perform vault.update_secret(r.refresh_secret_id, 'consumed');

  update private.meli_refresh_recovery
  set expected_credential_version = null,
      expires_at = null,
      scope = '{}'::text[],
      consumed_at = now(),
      updated_at = now()
  where meli_account_id = p_account_id;

  insert into public.security_audit_log(
    org_id, meli_account_id, action, resource_type, resource_id, metadata
  )
  select ma.org_id, ma.id, 'oauth_refresh_committed', 'meli_account', ma.id::text,
         jsonb_build_object(
           'previous_credential_version', p_expected_version,
           'credential_version', v_new_version,
           'from_staged_recovery', true
         )
  from public.meli_accounts ma
  where ma.id = p_account_id;

  return query select v_access, v_new_version;
end;
$$;

create or replace function public.backend_mark_refresh_persistence_failure(
  p_account_id uuid,
  p_owner uuid,
  p_expected_version bigint,
  p_recoverable boolean,
  p_error_code text
)
returns boolean
language plpgsql
security definer
set search_path = private, public, pg_temp
as $$
declare
  c private.meli_oauth_credentials%rowtype;
  v_has_recovery boolean;
  v_code text := left(coalesce(nullif(p_error_code, ''), 'refresh_persistence_failure'), 120);
begin
  select * into c
  from private.meli_oauth_credentials
  where meli_account_id = p_account_id
  for update;

  if not found then return false; end if;
  if c.credential_version <> p_expected_version then return false; end if;
  if c.refresh_lease_owner is distinct from p_owner then return false; end if;

  select exists(
    select 1
    from private.meli_refresh_recovery r
    where r.meli_account_id = p_account_id
      and r.expected_credential_version = p_expected_version
      and r.staged_at is not null
      and r.consumed_at is null
  ) into v_has_recovery;

  if p_recoverable and not v_has_recovery then
    raise exception 'refresh_recovery_missing';
  end if;

  update private.meli_oauth_credentials
  set refresh_lease_owner = null,
      refresh_lease_until = null,
      last_error_code = case when p_recoverable then 'refresh_commit_deferred' else v_code end,
      last_error_at = now(),
      updated_at = now()
  where meli_account_id = p_account_id;

  if not p_recoverable then
    update public.meli_accounts
    set status = 'reconnect_required',
        status_reason = v_code,
        updated_at = now()
    where id = p_account_id;
  end if;

  insert into public.security_audit_log(
    org_id, meli_account_id, action, resource_type, resource_id, metadata
  )
  select ma.org_id, ma.id,
         case when p_recoverable then 'oauth_refresh_commit_deferred'
              else 'oauth_refresh_result_unpersisted' end,
         'meli_account', ma.id::text,
         jsonb_build_object(
           'credential_version', p_expected_version,
           'recoverable', p_recoverable,
           'error_code', v_code
         )
  from public.meli_accounts ma
  where ma.id = p_account_id;

  return true;
end;
$$;

revoke all on function public.backend_stage_refresh_recovery(uuid,uuid,bigint,text,text,timestamptz,text[])
  from public, anon, authenticated;
revoke all on function public.backend_commit_staged_refresh(uuid,uuid,bigint)
  from public, anon, authenticated;
revoke all on function public.backend_mark_refresh_persistence_failure(uuid,uuid,bigint,boolean,text)
  from public, anon, authenticated;

grant execute on function public.backend_stage_refresh_recovery(uuid,uuid,bigint,text,text,timestamptz,text[])
  to service_role;
grant execute on function public.backend_commit_staged_refresh(uuid,uuid,bigint)
  to service_role;
grant execute on function public.backend_mark_refresh_persistence_failure(uuid,uuid,bigint,boolean,text)
  to service_role;
