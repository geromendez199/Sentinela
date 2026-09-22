-- Sentinela ML - hardening discovered during real Supabase PG17 validation.
-- This migration is reset-safe: it discovers current webhook partitions dynamically.

-- Views in public are granted to API roles by Supabase default privileges. On PG15+
-- they must be security_invoker so underlying table RLS is evaluated as the caller.
alter view public.latest_reputation set (security_invoker = true);
alter view public.latest_risk_per_order set (security_invoker = true);
alter view public.open_operational_risk set (security_invoker = true);

revoke all on table public.latest_reputation from public, anon, authenticated;
revoke all on table public.latest_risk_per_order from public, anon, authenticated;
revoke all on table public.open_operational_risk from public, anon, authenticated;

grant select on table public.latest_reputation to authenticated, service_role;
grant select on table public.latest_risk_per_order to authenticated, service_role;
grant select on table public.open_operational_risk to authenticated, service_role;

-- Operational dedupe data is backend-only. RLS is still mandatory as defense in depth.
alter table public.webhook_dedupe enable row level security;
revoke all on table public.webhook_dedupe from public, anon, authenticated;

-- Physical partitions can be addressed directly by PostgREST if grants/default grants
-- allow it. Discover every partition attached to webhook_events instead of hardcoding
-- calendar months so this migration remains valid on future db reset runs.
do $$
declare
  r record;
begin
  for r in
    select n.nspname as schema_name, c.relname as table_name
    from pg_inherits i
    join pg_class c on c.oid = i.inhrelid
    join pg_namespace n on n.oid = c.relnamespace
    where i.inhparent = 'public.webhook_events'::regclass
  loop
    execute format('alter table %I.%I enable row level security', r.schema_name, r.table_name);
    execute format('revoke all on table %I.%I from public, anon, authenticated', r.schema_name, r.table_name);
  end loop;
end $$;

-- Future partitions must inherit the same hardening immediately after creation.
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
  execute format('alter table public.%I enable row level security', v_name);
  execute format('revoke all on table public.%I from public, anon, authenticated', v_name);
end;
$$;

revoke all on function public.backend_create_webhook_partition(date) from public, anon, authenticated;
grant execute on function public.backend_create_webhook_partition(date) to service_role;

-- Supabase default privileges granted anon EXECUTE when these SECURITY DEFINER
-- helpers were created. Anonymous callers do not need direct RPC access.
revoke all on function public.create_organization(text,text) from public, anon;
revoke all on function public.is_org_member(uuid) from public, anon;
revoke all on function public.org_role_for(uuid) from public, anon;

grant execute on function public.create_organization(text,text) to authenticated;
grant execute on function public.is_org_member(uuid) to authenticated, service_role;
grant execute on function public.org_role_for(uuid) to authenticated, service_role;
