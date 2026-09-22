-- Sentinela ML - backend-only PGMQ facade for Edge Functions.
-- pgmq_public is intentionally not exposed through the Data API.

create or replace function public.backend_queue_read(
  p_queue text,
  p_visibility_seconds integer,
  p_qty integer
)
returns table(msg_id bigint, read_ct integer, enqueued_at timestamptz, message jsonb)
language sql
security definer
set search_path = pgmq, public, pg_temp
as $$
  select r.msg_id, r.read_ct, r.enqueued_at, r.message
  from pgmq.read(p_queue, p_visibility_seconds, p_qty, '{}'::jsonb) r;
$$;

create or replace function public.backend_queue_delete(p_queue text, p_msg_id bigint)
returns boolean
language sql
security definer
set search_path = pgmq, public, pg_temp
as $$
  select pgmq.delete(p_queue, p_msg_id);
$$;

create or replace function public.backend_queue_set_vt(
  p_queue text,
  p_msg_id bigint,
  p_delay_seconds integer
)
returns boolean
language sql
security definer
set search_path = pgmq, public, pg_temp
as $$
  select exists(select 1 from pgmq.set_vt(p_queue, p_msg_id, p_delay_seconds));
$$;

create or replace function public.backend_queue_send(p_queue text, p_message jsonb)
returns bigint
language sql
security definer
set search_path = pgmq, public, pg_temp
as $$
  select msg_id from pgmq.send(p_queue, p_message) as msg_id limit 1;
$$;

revoke all on function public.backend_queue_read(text,integer,integer) from public, anon, authenticated;
revoke all on function public.backend_queue_delete(text,bigint) from public, anon, authenticated;
revoke all on function public.backend_queue_set_vt(text,bigint,integer) from public, anon, authenticated;
revoke all on function public.backend_queue_send(text,jsonb) from public, anon, authenticated;

grant execute on function public.backend_queue_read(text,integer,integer) to service_role;
grant execute on function public.backend_queue_delete(text,bigint) to service_role;
grant execute on function public.backend_queue_set_vt(text,bigint,integer) to service_role;
grant execute on function public.backend_queue_send(text,jsonb) to service_role;
