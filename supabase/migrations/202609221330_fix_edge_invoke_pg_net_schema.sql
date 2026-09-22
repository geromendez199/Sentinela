-- Sentinela ML - fix pg_net invocation on hosted Supabase PG17.
-- pg_net installs its callable API in schema net, not as extensions.net.*.
create or replace function private.edge_invoke(p_function text, p_body jsonb default '{}'::jsonb)
returns bigint
language plpgsql
security definer
set search_path = private, public, net, vault, pg_temp
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

  select net.http_post(
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
