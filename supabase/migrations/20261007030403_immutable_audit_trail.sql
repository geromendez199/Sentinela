-- CloudTrail-style append-only audit ledger. References are intentionally not
-- foreign keys: audit evidence must survive deletion of operational records.
create table public.immutable_audit_events (
  sequence_id bigint generated always as identity primary key,
  event_id uuid not null default gen_random_uuid() unique,
  org_id uuid,
  actor_id uuid,
  action text not null,
  resource_type text not null,
  resource_id text,
  previous_state jsonb,
  source text not null check (source in ('database_trigger', 'security_audit')),
  correlation_id uuid,
  metadata jsonb not null default '{}'::jsonb,
  event_hash text not null,
  occurred_at timestamptz not null default now()
);

create index immutable_audit_org_time_idx
  on public.immutable_audit_events(org_id, occurred_at desc);
create index immutable_audit_resource_idx
  on public.immutable_audit_events(org_id, resource_type, resource_id, occurred_at desc);

alter table public.immutable_audit_events enable row level security;
create policy immutable_audit_admin_read on public.immutable_audit_events
  for select to authenticated
  using (public.org_role_for(org_id) in ('owner'::public.org_role, 'admin'::public.org_role));

revoke all on public.immutable_audit_events from public, anon, authenticated;
grant select on public.immutable_audit_events to authenticated, service_role;

create or replace function private.block_immutable_audit_mutation()
returns trigger
language plpgsql
set search_path = private, public, pg_temp
as $$
begin
  raise exception 'immutable_audit_events_are_append_only';
end;
$$;

create trigger immutable_audit_no_update_or_delete
before update or delete on public.immutable_audit_events
for each row execute function private.block_immutable_audit_mutation();

create or replace function private.append_immutable_audit(
  p_org_id uuid,
  p_actor_id uuid,
  p_action text,
  p_resource_type text,
  p_resource_id text,
  p_previous_state jsonb,
  p_source text,
  p_correlation_id uuid,
  p_metadata jsonb
)
returns void
language plpgsql
security definer
set search_path = public, extensions, pg_temp
as $$
declare
  v_event_id uuid := gen_random_uuid();
  v_occurred_at timestamptz := clock_timestamp();
  v_hash text;
begin
  v_hash := encode(digest(concat_ws('|',
    v_event_id::text,
    coalesce(p_org_id::text, ''),
    coalesce(p_actor_id::text, ''),
    p_action,
    p_resource_type,
    coalesce(p_resource_id, ''),
    coalesce(p_previous_state::text, ''),
    v_occurred_at::text
  ), 'sha256'), 'hex');

  insert into public.immutable_audit_events(
    event_id, org_id, actor_id, action, resource_type, resource_id,
    previous_state, source, correlation_id, metadata, event_hash, occurred_at
  ) values (
    v_event_id, p_org_id, p_actor_id, p_action, p_resource_type, p_resource_id,
    p_previous_state, p_source, p_correlation_id, coalesce(p_metadata, '{}'::jsonb),
    v_hash, v_occurred_at
  );
end;
$$;

revoke all on function private.append_immutable_audit(uuid,uuid,text,text,text,jsonb,text,uuid,jsonb)
  from public, anon, authenticated;

create or replace function private.audit_critical_row_change()
returns trigger
language plpgsql
security definer
set search_path = public, private, pg_temp
as $$
declare
  v_old jsonb := case when tg_op = 'INSERT' then null else to_jsonb(old) end;
  v_row jsonb := case when tg_op = 'DELETE' then to_jsonb(old) else to_jsonb(new) end;
  v_org_id uuid;
  v_resource_id text;
begin
  v_org_id := nullif(v_row->>'org_id', '')::uuid;
  v_resource_id := coalesce(
    v_row->>'id',
    v_row->>'action_draft_id',
    v_row->>'user_id',
    v_row->>'meli_account_id',
    v_row->>'entity',
    v_org_id::text
  );

  -- Avoid copying message bodies, generated text or provider responses into
  -- the compliance ledger. State transitions and configuration remain visible.
  if v_old is not null then
    v_old := v_old
      - 'rendered_text'
      - 'payload_sanitized'
      - 'external_result'
      - 'body'
      - 'title';
  end if;

  perform private.append_immutable_audit(
    v_org_id,
    auth.uid(),
    lower(tg_op),
    tg_table_name,
    v_resource_id,
    v_old,
    'database_trigger',
    null,
    jsonb_build_object('schema', tg_table_schema)
  );
  return case when tg_op = 'DELETE' then old else new end;
end;
$$;

revoke all on function private.audit_critical_row_change() from public, anon, authenticated;

create trigger audit_action_drafts
after insert or update or delete on public.action_drafts
for each row execute function private.audit_critical_row_change();
create trigger audit_action_executions
after insert or update or delete on public.action_executions
for each row execute function private.audit_critical_row_change();
create trigger audit_alerts
after insert or update or delete on public.alerts
for each row execute function private.audit_critical_row_change();
create trigger audit_playbook_rules
after insert or update or delete on public.playbook_rules
for each row execute function private.audit_critical_row_change();
create trigger audit_retention_policies
after insert or update or delete on public.retention_policies
for each row execute function private.audit_critical_row_change();
create trigger audit_organization_members
after insert or update or delete on public.organization_members
for each row execute function private.audit_critical_row_change();
create trigger audit_meli_accounts
after insert or update or delete on public.meli_accounts
for each row execute function private.audit_critical_row_change();

create or replace function private.mirror_security_audit_event()
returns trigger
language plpgsql
security definer
set search_path = public, private, pg_temp
as $$
begin
  perform private.append_immutable_audit(
    new.org_id,
    new.actor_user_id,
    new.action,
    coalesce(new.resource_type, 'unknown'),
    new.resource_id,
    new.metadata->'previous_state',
    'security_audit',
    new.correlation_id,
    new.metadata - 'previous_state'
  );
  return new;
end;
$$;

revoke all on function private.mirror_security_audit_event() from public, anon, authenticated;
create trigger mirror_security_audit_event
after insert on public.security_audit_log
for each row execute function private.mirror_security_audit_event();
