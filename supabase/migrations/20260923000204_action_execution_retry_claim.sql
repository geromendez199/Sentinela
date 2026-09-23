-- A2 QA fix: atomically claim/reclaim approved action executions.
-- A recent unfinished attempt remains in-progress; a stale unfinished attempt is
-- reclaimed with attempt+1. Finished executions are terminal and deduplicated.

create or replace function public.backend_claim_action_execution(
  p_org_id uuid,
  p_account_id uuid,
  p_action_id uuid,
  p_idempotency_key text,
  p_correlation_id uuid default null,
  p_stale_after_seconds integer default 45
)
returns table(
  execution_id uuid,
  attempt integer,
  should_execute boolean,
  claim_state text
)
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  e public.action_executions%rowtype;
  v_id uuid;
begin
  if p_stale_after_seconds < 15 or p_stale_after_seconds > 600 then
    raise exception 'invalid_stale_window';
  end if;

  insert into public.action_executions(
    org_id, meli_account_id, action_draft_id, idempotency_key, correlation_id
  )
  values (p_org_id, p_account_id, p_action_id, p_idempotency_key, p_correlation_id)
  on conflict (idempotency_key) do nothing
  returning id into v_id;

  if v_id is not null then
    return query select v_id, 1, true, 'new'::text;
    return;
  end if;

  select * into e
  from public.action_executions
  where idempotency_key = p_idempotency_key
  for update;

  if not found then
    raise exception 'action_execution_claim_lost';
  end if;

  if e.org_id is distinct from p_org_id
     or e.meli_account_id is distinct from p_account_id
     or e.action_draft_id is distinct from p_action_id then
    raise exception 'action_execution_key_conflict';
  end if;

  if e.finished_at is not null then
    return query select e.id, e.attempt, false, e.outcome;
    return;
  end if;

  if e.outcome <> 'started' then
    raise exception 'action_execution_invalid_unfinished_state:%', e.outcome;
  end if;

  if e.started_at > now() - make_interval(secs => p_stale_after_seconds) then
    return query select e.id, e.attempt, false, 'in_progress'::text;
    return;
  end if;

  update public.action_executions
  set attempt = e.attempt + 1,
      started_at = now(),
      correlation_id = coalesce(p_correlation_id, e.correlation_id),
      http_status = null,
      error_class = null
  where id = e.id
  returning * into e;

  return query select e.id, e.attempt, true, 'retry'::text;
end;
$$;

revoke all on function public.backend_claim_action_execution(uuid,uuid,uuid,text,uuid,integer)
  from public, anon, authenticated;
grant execute on function public.backend_claim_action_execution(uuid,uuid,uuid,text,uuid,integer)
  to service_role;
