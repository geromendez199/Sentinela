-- RLS isolation tests (pgTAP). Run with: supabase test db
--
-- Definition of done, section 1: isolation proven between at least two
-- organizations and two accounts, and no browser role able to reach private
-- schemas, Vault or MercadoLibre tokens.

begin;
select plan(16);

-- Deterministic canonical UUID fixtures: users, organizations and accounts are
-- intentionally distinct while remaining valid UUID text on every PG version.
insert into auth.users(id) values
  ('00000000-0000-4000-8000-000000000001'),
  ('00000000-0000-4000-8000-000000000002');

insert into public.organizations(id, name, slug, created_by) values
  ('10000000-0000-4000-8000-000000000001', 'Org A', 'org-a', '00000000-0000-4000-8000-000000000001'),
  ('10000000-0000-4000-8000-000000000002', 'Org B', 'org-b', '00000000-0000-4000-8000-000000000002');

insert into public.organization_members(org_id, user_id, role) values
  ('10000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000000001', 'owner'),
  ('10000000-0000-4000-8000-000000000002', '00000000-0000-4000-8000-000000000002', 'owner');

insert into public.meli_accounts(id, org_id, seller_id, site_id, status) values
  ('20000000-0000-4000-8000-000000000001', '10000000-0000-4000-8000-000000000001', 111, 'MLA', 'active'),
  ('20000000-0000-4000-8000-000000000002', '10000000-0000-4000-8000-000000000002', 222, 'MLB', 'active');

insert into public.orders(org_id, meli_account_id, order_id, status, date_created, source_last_updated) values
  ('10000000-0000-4000-8000-000000000001', '20000000-0000-4000-8000-000000000001', 1, 'paid', now(), now()),
  ('10000000-0000-4000-8000-000000000002', '20000000-0000-4000-8000-000000000002', 2, 'paid', now(), now());

-- Also exercise a security_invoker view: these rows must remain tenant-isolated.
insert into public.reputation_snapshots(org_id, meli_account_id, level_id, sales_completed) values
  ('10000000-0000-4000-8000-000000000001', '20000000-0000-4000-8000-000000000001', '5_green', 101),
  ('10000000-0000-4000-8000-000000000002', '20000000-0000-4000-8000-000000000002', '1_red', 202);

-- Act as the owner of org A.
set local role authenticated;
set local request.jwt.claims = '{"sub":"00000000-0000-4000-8000-000000000001","role":"authenticated"}';

select is((select count(*)::int from public.organizations), 1, 'org A sees only its own organization');
select is((select count(*)::int from public.orders), 1, 'org A sees only its own orders');
select is((select count(*)::int from public.meli_accounts), 1, 'org A sees only its own MercadoLibre account');
select is((select order_id from public.orders), 1::bigint, 'the visible order belongs to org A');
select is((select count(*)::int from public.latest_reputation), 1, 'security_invoker reputation view sees only org A');

-- Cross-organization reads return zero rows, never another org's data.
select is(
  (select count(*)::int from public.orders where org_id = '10000000-0000-4000-8000-000000000002'),
  0,
  'org A cannot read org B orders even when naming the org id'
);

-- Mirrors are read-only for the browser: no write policy exists.
select throws_ok(
  $$insert into public.orders(org_id, meli_account_id, order_id, status, date_created, source_last_updated)
    values ('10000000-0000-4000-8000-000000000001','20000000-0000-4000-8000-000000000001',9,'paid',now(),now())$$,
  '42501',
  null,
  'authenticated cannot insert into the orders mirror'
);

-- PostgreSQL RLS UPDATE without an applicable policy is intentionally silent:
-- the statement succeeds but updates zero rows. Assert both properties.
select lives_ok(
  $$update public.meli_accounts set status = 'degraded'$$,
  'authenticated UPDATE on meli_accounts is silently filtered by RLS'
);
select is(
  (select status::text from public.meli_accounts),
  'active',
  'authenticated cannot mutate the visible meli_account through direct UPDATE'
);

-- Private schema, Vault and token RPCs are unreachable from the browser role.
select throws_ok(
  $$select * from private.meli_oauth_credentials$$,
  null, null,
  'authenticated cannot read private.meli_oauth_credentials'
);

select throws_ok(
  $$select * from vault.decrypted_secrets$$,
  null, null,
  'authenticated cannot read vault.decrypted_secrets'
);

select throws_ok(
  $$select public.backend_get_oauth_material('20000000-0000-4000-8000-000000000001')$$,
  null, null,
  'authenticated cannot execute the token material RPC'
);

select throws_ok(
  $$select public.backend_commit_refresh('20000000-0000-4000-8000-000000000001', gen_random_uuid(), 1, 'a', 'b', now(), '{}')$$,
  null, null,
  'authenticated cannot commit a token refresh'
);

-- Audit is owner/admin only; a viewer in the same org must not read it.
reset role;
insert into auth.users(id) values ('00000000-0000-4000-8000-000000000003');
insert into public.organization_members(org_id, user_id, role)
values ('10000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000000003', 'viewer');
insert into public.security_audit_log(org_id, action) values ('10000000-0000-4000-8000-000000000001', 'oauth_linked');

set local role authenticated;
set local request.jwt.claims = '{"sub":"00000000-0000-4000-8000-000000000003","role":"authenticated"}';

select is((select count(*)::int from public.security_audit_log), 0, 'a viewer cannot read the audit log');
select is((select count(*)::int from public.orders), 1, 'a viewer still reads its own org orders');

select throws_ok(
  $$insert into public.playbook_rules(org_id, name, trigger_kind, conditions, actions, created_by)
    values ('10000000-0000-4000-8000-000000000001','x','risk_score','{}','[]','00000000-0000-4000-8000-000000000003')$$,
  null, null,
  'a viewer cannot create playbook rules'
);

select * from finish();
rollback;
