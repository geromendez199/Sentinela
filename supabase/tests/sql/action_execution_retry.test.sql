-- A2: action execution retry/idempotency claim tests.
begin;
select plan(7);

insert into auth.users(id) values ('00000000-0000-4000-8000-000000000081');
insert into public.organizations(id,name,slug,created_by)
values ('18000000-0000-4000-8000-000000000001','A2 Retry Org','a2-retry-org','00000000-0000-4000-8000-000000000081');
insert into public.organization_members(org_id,user_id,role)
values ('18000000-0000-4000-8000-000000000001','00000000-0000-4000-8000-000000000081','owner');
insert into public.meli_accounts(id,org_id,seller_id,site_id,status)
values ('28000000-0000-4000-8000-000000000001','18000000-0000-4000-8000-000000000001',880001,'MLA','active');
insert into public.action_drafts(
  id,org_id,meli_account_id,kind,status,requires_approval,idempotency_key,approved_by,approved_at
) values (
  '38000000-0000-4000-8000-000000000001','18000000-0000-4000-8000-000000000001',
  '28000000-0000-4000-8000-000000000001','PAUSE_ITEM','approved',true,'a2:retry:1',
  '00000000-0000-4000-8000-000000000081',now()
);

select ok(
  (select should_execute from public.backend_claim_action_execution(
    '18000000-0000-4000-8000-000000000001','28000000-0000-4000-8000-000000000001',
    '38000000-0000-4000-8000-000000000001','a2:retry:1',null,45
  )),
  'first claim executes'
);

select is(
  (select attempt from public.action_executions where idempotency_key='a2:retry:1'),
  1,
  'first claim starts attempt 1'
);

select is(
  (select claim_state from public.backend_claim_action_execution(
    '18000000-0000-4000-8000-000000000001','28000000-0000-4000-8000-000000000001',
    '38000000-0000-4000-8000-000000000001','a2:retry:1',null,45
  )),
  'in_progress',
  'fresh duplicate is not allowed to double execute'
);

update public.action_executions
set started_at = now() - interval '60 seconds', error_class='meli_rate_limited'
where idempotency_key='a2:retry:1';

select ok(
  (select should_execute from public.backend_claim_action_execution(
    '18000000-0000-4000-8000-000000000001','28000000-0000-4000-8000-000000000001',
    '38000000-0000-4000-8000-000000000001','a2:retry:1',null,45
  )),
  'stale unfinished attempt is reclaimed'
);

select is(
  (select attempt from public.action_executions where idempotency_key='a2:retry:1'),
  2,
  'reclaimed execution increments attempt'
);

update public.action_executions
set outcome='executed', finished_at=now()
where idempotency_key='a2:retry:1';

select is(
  (select claim_state from public.backend_claim_action_execution(
    '18000000-0000-4000-8000-000000000001','28000000-0000-4000-8000-000000000001',
    '38000000-0000-4000-8000-000000000001','a2:retry:1',null,45
  )),
  'executed',
  'finished execution is permanently deduplicated'
);

select throws_ok(
  $$select * from public.backend_claim_action_execution(
    '18000000-0000-4000-8000-000000000001','28000000-0000-4000-8000-000000000001',
    gen_random_uuid(),'a2:retry:1',null,45
  )$$,
  'P0001', 'action_execution_key_conflict',
  'idempotency key cannot be reused for a different draft'
);

select * from finish();
rollback;
