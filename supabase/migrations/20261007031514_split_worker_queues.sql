-- Each worker gets its own queue. Competing consumers on the former shared
-- derived_jobs queue could reserve one another's work until visibility expiry.
do $$
declare
  v_queue text;
begin
  foreach v_queue in array array[
    'risk_jobs', 'classification_jobs', 'action_jobs',
    'derived_jobs_dlq', 'outbound_alerts_dlq'
  ] loop
    if not exists (select 1 from pgmq.meta where queue_name = v_queue) then
      perform pgmq.create(v_queue);
    end if;
  end loop;
end;
$$;

alter table public.dead_letter_events add column dlq_message_id bigint;

alter table public.queue_idempotency
  drop constraint queue_idempotency_queue_name_check;
alter table public.queue_idempotency
  add constraint queue_idempotency_queue_name_check check (
    queue_name in (
      'meli_events', 'derived_jobs', 'risk_jobs', 'classification_jobs',
      'action_jobs', 'outbound_alerts'
    )
  );

create or replace function private.is_sentinela_queue(p_queue text, p_writable boolean default false)
returns boolean
language sql
immutable
set search_path = pg_temp
as $$
  select case
    when p_writable then p_queue in (
      'meli_events', 'derived_jobs', 'risk_jobs', 'classification_jobs',
      'action_jobs', 'outbound_alerts'
    )
    else p_queue in (
      'meli_events', 'meli_events_dlq', 'derived_jobs', 'derived_jobs_dlq',
      'risk_jobs', 'classification_jobs', 'action_jobs',
      'outbound_alerts', 'outbound_alerts_dlq'
    )
  end;
$$;
revoke all on function private.is_sentinela_queue(text,boolean) from public, anon, authenticated;

create or replace function public.backend_queue_read(
  p_queue text,
  p_visibility_seconds integer,
  p_qty integer
)
returns table(msg_id bigint, read_ct integer, enqueued_at timestamptz, message jsonb)
language plpgsql
security definer
set search_path = pgmq, public, private, pg_temp
as $$
begin
  if not private.is_sentinela_queue(p_queue) then raise exception 'queue_not_allowed'; end if;
  return query
    select r.msg_id, r.read_ct, r.enqueued_at, r.message
    from pgmq.read(p_queue, greatest(1, least(p_visibility_seconds, 900)), greatest(1, least(p_qty, 100)), '{}'::jsonb) r;
end;
$$;

create or replace function public.backend_queue_delete(p_queue text, p_msg_id bigint)
returns boolean
language plpgsql
security definer
set search_path = pgmq, public, private, pg_temp
as $$
begin
  if not private.is_sentinela_queue(p_queue) then raise exception 'queue_not_allowed'; end if;
  return pgmq.delete(p_queue, p_msg_id);
end;
$$;

create or replace function public.backend_queue_set_vt(
  p_queue text,
  p_msg_id bigint,
  p_delay_seconds integer
)
returns boolean
language plpgsql
security definer
set search_path = pgmq, public, private, pg_temp
as $$
begin
  if not private.is_sentinela_queue(p_queue, true) then raise exception 'queue_not_allowed'; end if;
  return exists(select 1 from pgmq.set_vt(p_queue, p_msg_id, greatest(0, least(p_delay_seconds, 86400))));
end;
$$;

create or replace function public.backend_queue_send(p_queue text, p_message jsonb)
returns bigint
language plpgsql
security definer
set search_path = pgmq, public, private, pg_temp
as $$
declare v_message_id bigint;
begin
  if not private.is_sentinela_queue(p_queue, true) then raise exception 'queue_not_allowed'; end if;
  select msg_id into v_message_id from pgmq.send(p_queue, p_message) as msg_id limit 1;
  return v_message_id;
end;
$$;

create or replace function public.backend_queue_send_once(
  p_queue text,
  p_idempotency_key text,
  p_message jsonb
)
returns bigint
language plpgsql
security definer
set search_path = pgmq, public, private, pg_temp
as $$
declare v_message_id bigint;
begin
  if not private.is_sentinela_queue(p_queue, true) then raise exception 'queue_not_allowed'; end if;
  if nullif(trim(p_idempotency_key), '') is null or length(p_idempotency_key) > 256 then
    raise exception 'invalid_idempotency_key';
  end if;
  insert into public.queue_idempotency(queue_name, idempotency_key)
  values (p_queue, p_idempotency_key)
  on conflict (queue_name, idempotency_key) do nothing;
  if not found then
    select message_id into v_message_id from public.queue_idempotency
    where queue_name = p_queue and idempotency_key = p_idempotency_key;
    return v_message_id;
  end if;
  select msg_id into v_message_id from pgmq.send(p_queue, p_message) as msg_id limit 1;
  update public.queue_idempotency set message_id = v_message_id
  where queue_name = p_queue and idempotency_key = p_idempotency_key;
  return v_message_id;
end;
$$;

create or replace function public.backend_queue_dead_letter(
  p_source_queue text,
  p_source_message_id bigint,
  p_source_read_count integer,
  p_message jsonb,
  p_failure_class text,
  p_failure_reason text
)
returns bigint
language plpgsql
security definer
set search_path = pgmq, public, private, pg_temp
as $$
declare
  v_dlq text;
  v_dlq_message_id bigint;
begin
  if p_source_queue not in ('meli_events', 'risk_jobs', 'classification_jobs', 'action_jobs', 'outbound_alerts') then
    raise exception 'source_queue_not_allowed';
  end if;
  if p_source_read_count < 3 then raise exception 'dlq_requires_three_attempts'; end if;
  v_dlq := case when p_source_queue = 'meli_events' then 'meli_events_dlq'
                when p_source_queue = 'outbound_alerts' then 'outbound_alerts_dlq'
                else 'derived_jobs_dlq' end;

  insert into public.dead_letter_events(
    org_id, meli_account_id, source_queue, source_message_id, source_read_count,
    event_key, failure_class, failure_reason, payload
  ) values (
    nullif(p_message->>'org_id', '')::uuid,
    nullif(p_message->>'meli_account_id', '')::uuid,
    p_source_queue, p_source_message_id, p_source_read_count,
    coalesce(p_message->>'event_key', p_message->>'job'),
    left(p_failure_class, 120), left(p_failure_reason, 1000), p_message
  ) on conflict (source_queue, source_message_id) do nothing;

  select msg_id into v_dlq_message_id from pgmq.send(v_dlq, jsonb_build_object(
    'source_queue', p_source_queue, 'source_message_id', p_source_message_id,
    'read_count', p_source_read_count, 'failure_class', left(p_failure_class, 120),
    'failure_reason', left(p_failure_reason, 1000), 'failed_at', now(), 'message', p_message
  )) as msg_id limit 1;
  update public.dead_letter_events set dlq_message_id = v_dlq_message_id
  where source_queue = p_source_queue and source_message_id = p_source_message_id;
  if not pgmq.delete(p_source_queue, p_source_message_id) then
    raise exception 'source_message_delete_failed';
  end if;
  return v_dlq_message_id;
end;
$$;

-- Move every pending legacy job once. Unknown job kinds are retained in the
-- derived DLQ for inspection rather than silently cycling forever.
do $$
declare
  v_entry record;
  v_target text;
begin
  for v_entry in select * from pgmq.read('derived_jobs', 300, 10000) loop
    v_target := case v_entry.message->>'job'
      when 'risk_score' then 'risk_jobs'
      when 'classify_text' then 'classification_jobs'
      when 'execute_approved_action' then 'action_jobs'
      else 'derived_jobs_dlq'
    end;
    perform pgmq.send(v_target, v_entry.message);
    perform pgmq.delete('derived_jobs', v_entry.msg_id);
  end loop;
end;
$$;

-- Preserve the public RPC contract while routing action execution directly to
-- its sole consumer and making repeated enqueue requests harmless.
create or replace function public.backend_enqueue_action_execution(
  p_action_id uuid,
  p_org_id uuid,
  p_actor uuid,
  p_correlation_id uuid default null
)
returns void
language plpgsql
security definer
set search_path = public, pgmq, pg_temp
as $$
declare
  d public.action_drafts%rowtype;
begin
  select * into d from public.action_drafts
  where id = p_action_id and org_id = p_org_id and status in ('approved', 'executing')
  for update;
  if not found then raise exception 'action_not_approved'; end if;

  if d.status = 'approved' then
    update public.action_drafts set status = 'executing', updated_at = now() where id = p_action_id;
    perform public.backend_queue_send_once('action_jobs', 'execute:' || p_action_id::text, jsonb_build_object(
      'job', 'execute_approved_action', 'action_draft_id', p_action_id,
      'org_id', p_org_id, 'meli_account_id', d.meli_account_id,
      'correlation_id', p_correlation_id
    ));
    insert into public.security_audit_log(org_id, actor_user_id, meli_account_id, action, resource_type, resource_id, correlation_id)
    values (p_org_id, p_actor, d.meli_account_id, 'action_execution_enqueued', 'action_draft', p_action_id::text, p_correlation_id);
  end if;
end;
$$;

-- Materialize high-risk scores into the in-app alert center. The advisory lock
-- makes the read/update/insert sequence safe when duplicate jobs race.
create or replace function public.backend_raise_risk_alert(
  p_org_id uuid,
  p_account_id uuid,
  p_order_id bigint,
  p_band text,
  p_probability numeric,
  p_risk_score_id uuid
)
returns uuid
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_alert_id uuid;
  v_severity text := case when p_band = 'critical' then 'critical' else 'high' end;
begin
  if p_band not in ('high', 'critical') or p_order_id is null then return null; end if;
  perform pg_advisory_xact_lock(hashtextextended(p_org_id::text || ':order_risk:' || p_order_id::text, 0));

  select id into v_alert_id from public.alerts
  where org_id = p_org_id and kind = 'order_risk' and resource_type = 'order'
    and resource_id = p_order_id::text and status = 'open'
  order by created_at desc limit 1 for update;

  if v_alert_id is not null then
    update public.alerts
    set severity = v_severity,
        title = case when p_band = 'critical' then 'Orden con riesgo crítico' else 'Orden con riesgo alto' end,
        body = format('Riesgo estimado: %s%%. Revisá las señales y el playbook antes de intervenir.', round(p_probability * 100, 1))
    where id = v_alert_id;
    return v_alert_id;
  end if;

  insert into public.alerts(
    org_id, meli_account_id, severity, kind, title, body,
    resource_type, resource_id, channels
  ) values (
    p_org_id, p_account_id, v_severity, 'order_risk',
    case when p_band = 'critical' then 'Orden con riesgo crítico' else 'Orden con riesgo alto' end,
    format('Riesgo estimado: %s%%. Revisá las señales y el playbook antes de intervenir.', round(p_probability * 100, 1)),
    'order', p_order_id::text,
    jsonb_build_array(jsonb_build_object('type', 'in_app'))
  ) returning id into v_alert_id;

  insert into public.security_audit_log(
    org_id, meli_account_id, action, resource_type, resource_id, metadata
  ) values (
    p_org_id, p_account_id, 'risk_alert_raised', 'alert', v_alert_id::text,
    jsonb_build_object('order_id', p_order_id, 'risk_score_id', p_risk_score_id, 'band', p_band)
  );
  return v_alert_id;
end;
$$;

revoke all on function public.backend_raise_risk_alert(uuid,uuid,bigint,text,numeric,uuid)
  from public, anon, authenticated;
grant execute on function public.backend_raise_risk_alert(uuid,uuid,bigint,text,numeric,uuid)
  to service_role;

create or replace function public.backend_retry_dead_letter(
  p_dead_letter_id bigint,
  p_org_id uuid,
  p_actor uuid
)
returns bigint
language plpgsql
security definer
set search_path = public, pgmq, pg_temp
as $$
declare
  d public.dead_letter_events%rowtype;
  v_message_id bigint;
  v_dlq text;
begin
  select * into d from public.dead_letter_events
  where id = p_dead_letter_id and org_id = p_org_id and resolved_at is null
  for update;
  if not found then raise exception 'dead_letter_not_retryable'; end if;
  if d.source_queue not in ('meli_events', 'risk_jobs', 'classification_jobs', 'action_jobs', 'outbound_alerts') then
    raise exception 'source_queue_not_retryable';
  end if;

  select msg_id into v_message_id from pgmq.send(d.source_queue, d.payload) as msg_id limit 1;
  v_dlq := case when d.source_queue = 'meli_events' then 'meli_events_dlq'
                when d.source_queue = 'outbound_alerts' then 'outbound_alerts_dlq'
                else 'derived_jobs_dlq' end;
  if d.dlq_message_id is not null then perform pgmq.delete(v_dlq, d.dlq_message_id); end if;

  update public.dead_letter_events set resolved_at = now(), resolved_by = p_actor where id = d.id;
  if d.source_queue = 'meli_events' and nullif(d.payload->>'event_id', '') is not null then
    update public.webhook_events set status = 'queued', processed_at = null, processing_error = null
    where id = (d.payload->>'event_id')::uuid;
  end if;
  insert into public.security_audit_log(org_id, actor_user_id, meli_account_id, action, resource_type, resource_id, metadata)
  values (p_org_id, p_actor, d.meli_account_id, 'dead_letter_retried', 'dead_letter_event', d.id::text,
          jsonb_build_object('source_queue', d.source_queue, 'new_message_id', v_message_id));
  return v_message_id;
end;
$$;

revoke all on function public.backend_retry_dead_letter(bigint,uuid,uuid) from public, anon, authenticated;
grant execute on function public.backend_retry_dead_letter(bigint,uuid,uuid) to service_role;
