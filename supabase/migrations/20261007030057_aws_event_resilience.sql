-- Amazon SQS-style delivery guarantees for Mercado Libre ingestion.
-- Queue objects stay in pgmq's private schema; only tightly-scoped service RPCs
-- are exposed to Edge Functions.

do $$
begin
  if not exists (select 1 from pgmq.meta where queue_name = 'meli_events_dlq') then
    perform pgmq.create('meli_events_dlq');
  end if;
end;
$$;

create table public.queue_idempotency (
  queue_name text not null,
  idempotency_key text not null,
  message_id bigint,
  created_at timestamptz not null default now(),
  primary key (queue_name, idempotency_key),
  check (queue_name in ('meli_events', 'meli_events_dlq', 'derived_jobs', 'outbound_alerts'))
);

create index queue_idempotency_created_idx on public.queue_idempotency(created_at);
alter table public.queue_idempotency enable row level security;
revoke all on public.queue_idempotency from public, anon, authenticated;
grant select, insert, update, delete on public.queue_idempotency to service_role;

create table public.dead_letter_events (
  id bigint generated always as identity primary key,
  org_id uuid references public.organizations(id) on delete set null,
  meli_account_id uuid references public.meli_accounts(id) on delete set null,
  source_queue text not null,
  source_message_id bigint not null,
  source_read_count integer not null check (source_read_count >= 1),
  event_key text,
  failure_class text not null,
  failure_reason text not null,
  payload jsonb not null,
  created_at timestamptz not null default now(),
  resolved_at timestamptz,
  resolved_by uuid references auth.users(id) on delete set null,
  unique (source_queue, source_message_id)
);

create index dead_letter_events_org_time_idx
  on public.dead_letter_events(org_id, created_at desc);
create index dead_letter_events_unresolved_idx
  on public.dead_letter_events(created_at desc) where resolved_at is null;

alter table public.dead_letter_events enable row level security;
create policy dead_letter_events_admin_read on public.dead_letter_events
  for select to authenticated
  using (public.is_org_member(org_id, array['admin']::public.org_role[]));
revoke all on public.dead_letter_events from public, anon, authenticated;
grant select on public.dead_letter_events to authenticated;
grant select, insert, update on public.dead_letter_events to service_role;

-- Existing queue RPCs accepted arbitrary queue names. Restrict every operation
-- to Sentinela-owned queues before the service role reaches pgmq.
create or replace function public.backend_queue_read(
  p_queue text,
  p_visibility_seconds integer,
  p_qty integer
)
returns table(msg_id bigint, read_ct integer, enqueued_at timestamptz, message jsonb)
language plpgsql
security definer
set search_path = pgmq, public, pg_temp
as $$
begin
  if p_queue not in ('meli_events', 'meli_events_dlq', 'derived_jobs', 'outbound_alerts') then
    raise exception 'queue_not_allowed';
  end if;
  return query
    select r.msg_id, r.read_ct, r.enqueued_at, r.message
    from pgmq.read(p_queue, greatest(1, least(p_visibility_seconds, 900)), greatest(1, least(p_qty, 100)), '{}'::jsonb) r;
end;
$$;

create or replace function public.backend_queue_delete(p_queue text, p_msg_id bigint)
returns boolean
language plpgsql
security definer
set search_path = pgmq, public, pg_temp
as $$
begin
  if p_queue not in ('meli_events', 'meli_events_dlq', 'derived_jobs', 'outbound_alerts') then
    raise exception 'queue_not_allowed';
  end if;
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
set search_path = pgmq, public, pg_temp
as $$
begin
  if p_queue not in ('meli_events', 'derived_jobs', 'outbound_alerts') then
    raise exception 'queue_not_allowed';
  end if;
  return exists(
    select 1 from pgmq.set_vt(p_queue, p_msg_id, greatest(0, least(p_delay_seconds, 86400)))
  );
end;
$$;

create or replace function public.backend_queue_send(p_queue text, p_message jsonb)
returns bigint
language plpgsql
security definer
set search_path = pgmq, public, pg_temp
as $$
declare
  v_message_id bigint;
begin
  if p_queue not in ('meli_events', 'meli_events_dlq', 'derived_jobs', 'outbound_alerts') then
    raise exception 'queue_not_allowed';
  end if;
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
set search_path = pgmq, public, pg_temp
as $$
declare
  v_message_id bigint;
begin
  if p_queue not in ('meli_events', 'derived_jobs', 'outbound_alerts') then
    raise exception 'queue_not_allowed';
  end if;
  if nullif(trim(p_idempotency_key), '') is null or length(p_idempotency_key) > 256 then
    raise exception 'invalid_idempotency_key';
  end if;

  insert into public.queue_idempotency(queue_name, idempotency_key)
  values (p_queue, p_idempotency_key)
  on conflict (queue_name, idempotency_key) do nothing;

  if not found then
    select message_id into v_message_id
      from public.queue_idempotency
      where queue_name = p_queue and idempotency_key = p_idempotency_key;
    return v_message_id;
  end if;

  select msg_id into v_message_id from pgmq.send(p_queue, p_message) as msg_id limit 1;
  update public.queue_idempotency
    set message_id = v_message_id
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
set search_path = pgmq, public, pg_temp
as $$
declare
  v_dlq_message_id bigint;
begin
  if p_source_queue <> 'meli_events' then
    raise exception 'source_queue_not_allowed';
  end if;
  if p_source_read_count < 3 then
    raise exception 'dlq_requires_three_attempts';
  end if;

  insert into public.dead_letter_events(
    org_id, meli_account_id, source_queue, source_message_id,
    source_read_count, event_key, failure_class, failure_reason, payload
  ) values (
    nullif(p_message->>'org_id', '')::uuid,
    nullif(p_message->>'meli_account_id', '')::uuid,
    p_source_queue,
    p_source_message_id,
    p_source_read_count,
    p_message->>'event_key',
    left(p_failure_class, 120),
    left(p_failure_reason, 1000),
    p_message
  )
  on conflict (source_queue, source_message_id) do nothing;

  select msg_id into v_dlq_message_id
  from pgmq.send('meli_events_dlq', jsonb_build_object(
    'source_queue', p_source_queue,
    'source_message_id', p_source_message_id,
    'read_count', p_source_read_count,
    'failure_class', left(p_failure_class, 120),
    'failure_reason', left(p_failure_reason, 1000),
    'failed_at', now(),
    'message', p_message
  )) as msg_id limit 1;

  if not pgmq.delete(p_source_queue, p_source_message_id) then
    raise exception 'source_message_delete_failed';
  end if;
  return v_dlq_message_id;
end;
$$;

revoke all on function public.backend_queue_send_once(text,text,jsonb) from public, anon, authenticated;
revoke all on function public.backend_queue_dead_letter(text,bigint,integer,jsonb,text,text) from public, anon, authenticated;
grant execute on function public.backend_queue_send_once(text,text,jsonb) to service_role;
grant execute on function public.backend_queue_dead_letter(text,bigint,integer,jsonb,text,text) to service_role;
