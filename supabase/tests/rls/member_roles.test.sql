-- Organization role-management RPC security tests.
begin;
select plan(11);

insert into auth.users(id) values
  ('00000000-0000-4000-8000-000000000011'),
  ('00000000-0000-4000-8000-000000000012'),
  ('00000000-0000-4000-8000-000000000013'),
  ('00000000-0000-4000-8000-000000000014'),
  ('00000000-0000-4000-8000-000000000015');

insert into public.organizations(id, name, slug, created_by) values
  ('11000000-0000-4000-8000-000000000001', 'Roles Org', 'roles-org', '00000000-0000-4000-8000-000000000011');

insert into public.organization_members(org_id, user_id, role) values
  ('11000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000000011', 'owner'),
  ('11000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000000013', 'viewer');

set local role authenticated;
set local request.jwt.claims = '{"sub":"00000000-0000-4000-8000-000000000011","role":"authenticated"}';

select is(
  public.set_organization_member_role(
    '11000000-0000-4000-8000-000000000001',
    '00000000-0000-4000-8000-000000000012',
    'admin'
  )::text,
  'admin',
  'owner can add an admin'
);

select is(
  public.set_organization_member_role(
    '11000000-0000-4000-8000-000000000001',
    '00000000-0000-4000-8000-000000000014',
    'viewer'
  )::text,
  'viewer',
  'owner can add a viewer'
);

select throws_ok(
  $$select public.set_organization_member_role(
    '11000000-0000-4000-8000-000000000001',
    '00000000-0000-4000-8000-000000000011',
    'admin'
  )$$,
  'P0001', 'last_owner_required',
  'the only owner cannot demote themself'
);

-- Admin can manage operator/viewer but cannot grant or mutate privileged roles.
set local request.jwt.claims = '{"sub":"00000000-0000-4000-8000-000000000012","role":"authenticated"}';

select is(
  public.set_organization_member_role(
    '11000000-0000-4000-8000-000000000001',
    '00000000-0000-4000-8000-000000000014',
    'operator'
  )::text,
  'operator',
  'admin can promote viewer to operator'
);

select throws_ok(
  $$select public.set_organization_member_role(
    '11000000-0000-4000-8000-000000000001',
    '00000000-0000-4000-8000-000000000015',
    'admin'
  )$$,
  'P0001', 'owner_role_required',
  'admin cannot grant admin'
);

select throws_ok(
  $$select public.set_organization_member_role(
    '11000000-0000-4000-8000-000000000001',
    '00000000-0000-4000-8000-000000000011',
    'viewer'
  )$$,
  'P0001', 'owner_role_required',
  'admin cannot mutate an owner'
);

select ok(
  public.remove_organization_member(
    '11000000-0000-4000-8000-000000000001',
    '00000000-0000-4000-8000-000000000014'
  ),
  'admin can remove an operator'
);

select throws_ok(
  $$select public.remove_organization_member(
    '11000000-0000-4000-8000-000000000001',
    '00000000-0000-4000-8000-000000000011'
  )$$,
  'P0001', 'owner_role_required',
  'admin cannot remove an owner'
);

-- Viewer cannot use privileged RPCs.
set local request.jwt.claims = '{"sub":"00000000-0000-4000-8000-000000000013","role":"authenticated"}';
select throws_ok(
  $$select public.set_organization_member_role(
    '11000000-0000-4000-8000-000000000001',
    '00000000-0000-4000-8000-000000000015',
    'viewer'
  )$$,
  'P0001', 'insufficient_role',
  'viewer cannot manage membership'
);

-- Owner can add another owner; ownership invariant remains auditable.
set local request.jwt.claims = '{"sub":"00000000-0000-4000-8000-000000000011","role":"authenticated"}';
select is(
  public.set_organization_member_role(
    '11000000-0000-4000-8000-000000000001',
    '00000000-0000-4000-8000-000000000015',
    'owner'
  )::text,
  'owner',
  'owner can add a second owner'
);

select cmp_ok(
  (select count(*) from public.security_audit_log where org_id='11000000-0000-4000-8000-000000000001'),
  '>=', 4::bigint,
  'successful membership mutations are audited'
);

select * from finish();
rollback;
