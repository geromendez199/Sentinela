-- Sentinela ML - scheduled reconciliation jobs
-- Cron only pulses workers; it never creates one job per seller.
-- The Edge Function secret is read from Vault, never hardcoded in SQL.

create or replace function private.edge_invoke(p_function text, p_body jsonb default '{}'::jsonb)
returns bigint
language plpgsql
security definer
set search_path = private, public, extensions, pg_temp
as $$
declare
  v_base text;
  v_key text;
  v_request_id bigint;
begin
  select decrypted_secret into v_base from vault.decrypted_secrets where name = 'sentinela:edge_base_url';
  select decrypted_secret into v_key  from vault.decrypted_secrets where name = 'sentinela:edge_service_key';
  if v_base is null or v_key is null then
    raise exception 'edge_invoke_secrets_missing';
  end if;
  select extensions.net.http_post(
    url := v_base || '/functions/v1/' || p_function,
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || v_key
    ),
    body := p_body,
    timeout_milliseconds := 20000
  ) into v_request_id;
  return v_request_id;
end;
$$;

revoke all on function private.edge_invoke(text, jsonb) from public, anon, authenticated;

-- Worker pulses: each invocation drains a bounded batch from pgmq.
select cron.schedule('sentinela-resource-worker', '* * * * *',
  $$select private.edge_invoke('meli-resource-worker', jsonb_build_object('batch_size', 25))$$);

select cron.schedule('sentinela-backfill-worker', '*/2 * * * *',
  $$select private.edge_invoke('meli-backfill-worker', jsonb_build_object('max_chunks', 4))$$);

select cron.schedule('sentinela-missed-feeds', '*/10 * * * *',
  $$select private.edge_invoke('missed-feeds-sweep', '{}'::jsonb)$$);

select cron.schedule('sentinela-reputation-reconcile', '*/5 * * * *',
  $$select private.edge_invoke('reputation-reconcile', jsonb_build_object('priority', 'high_risk'))$$);

select cron.schedule('sentinela-reputation-reconcile-normal', '*/15 * * * *',
  $$select private.edge_invoke('reputation-reconcile', jsonb_build_object('priority', 'normal'))$$);

select cron.schedule('sentinela-risk-score', '*/3 * * * *',
  $$select private.edge_invoke('risk-score', jsonb_build_object('batch_size', 50))$$);

select cron.schedule('sentinela-classify-text', '*/5 * * * *',
  $$select private.edge_invoke('classify-text', jsonb_build_object('batch_size', 25))$$);

select cron.schedule('sentinela-root-cause-cluster', '17 3 * * *',
  $$select private.edge_invoke('root-cause-cluster', '{}'::jsonb)$$);

select cron.schedule('sentinela-outbound-alerts', '*/2 * * * *',
  $$select private.edge_invoke('send-alert', jsonb_build_object('batch_size', 20))$$);

select cron.schedule('sentinela-retention-purge', '23 4 * * *',
  $$select private.edge_invoke('retention-purge', '{}'::jsonb)$$);

-- Partitions are created two months ahead; a default partition prevents data loss on failure.
select cron.schedule('sentinela-create-partitions', '0 2 1 * *',
  $$select public.backend_create_webhook_partition((date_trunc('month', now()) + interval '1 month')::date),
           public.backend_create_webhook_partition((date_trunc('month', now()) + interval '2 month')::date)$$);
