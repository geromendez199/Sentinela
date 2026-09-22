-- Sentinela ML - explicit service-to-service authentication for pg_cron/pg_net -> Edge Functions.
--
-- New Supabase secret API keys are not JWTs. The cron path therefore uses an
-- independent high-entropy Sentinela invocation key stored only in Vault and
-- validates it inside each internal Edge Function before doing any work.

create or replace function public.backend_verify_edge_invocation_key(p_candidate text)
returns boolean
language sql
stable
security definer
set search_path = vault, extensions, pg_temp
as $$
  select coalesce((
    select extensions.digest(s.decrypted_secret, 'sha256') =
           extensions.digest(coalesce(p_candidate, ''), 'sha256')
    from vault.decrypted_secrets s
    where s.name = 'sentinela:edge_service_key'
    limit 1
  ), false);
$$;

revoke all on function public.backend_verify_edge_invocation_key(text)
  from public, anon, authenticated;
grant execute on function public.backend_verify_edge_invocation_key(text) to service_role;

comment on function public.backend_verify_edge_invocation_key(text) is
  'Backend-only validation of the Vault-held Sentinela internal Edge invocation key.';

create or replace function private.edge_invoke(p_function text, p_body jsonb default '{}'::jsonb)
returns bigint
language plpgsql
security definer
set search_path = private, public, extensions, vault, pg_temp
as $$
declare
  v_base text;
  v_key text;
  v_request_id bigint;
begin
  select decrypted_secret into v_base
  from vault.decrypted_secrets
  where name = 'sentinela:edge_base_url';

  select decrypted_secret into v_key
  from vault.decrypted_secrets
  where name = 'sentinela:edge_service_key';

  if v_base is null or v_key is null then
    raise exception 'edge_invoke_secrets_missing';
  end if;

  select extensions.net.http_post(
    url := rtrim(v_base, '/') || '/functions/v1/' || p_function,
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'X-Sentinela-Internal-Key', v_key
    ),
    body := coalesce(p_body, '{}'::jsonb),
    timeout_milliseconds := 20000
  ) into v_request_id;

  return v_request_id;
end;
$$;

revoke all on function private.edge_invoke(text, jsonb) from public, anon, authenticated;
