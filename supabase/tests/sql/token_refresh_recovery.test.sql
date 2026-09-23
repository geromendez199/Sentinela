-- A6: a rotated refresh token staged in Vault survives a failed canonical commit
-- and can be finalized by the next lease owner without reusing the old token.
begin;
select plan(15);

insert into auth.users(id) values ('00000000-0000-4000-8000-000000000061');
insert into public.organizations(id, name, slug, created_by) values (
  '16000000-0000-4000-8000-000000000001',
  'Refresh Recovery Org',
  'refresh-recovery-org',
  '00000000-0000-4000-8000-000000000061'
);
insert into public.organization_members(org_id, user_id, role) values (
  '16000000-0000-4000-8000-000000000001',
  '00000000-0000-4000-8000-000000000061',
  'owner'
);
insert into public.meli_accounts(id, org_id, seller_id, site_id, status) values (
  '26000000-0000-4000-8000-000000000001',
  '16000000-0000-4000-8000-000000000001',
  606061,
  'MLA',
  'active'
);

create temp table a6_secret_ids(access_id uuid, refresh_id uuid) on commit drop;
insert into a6_secret_ids(access_id, refresh_id)
select
  vault.create_secret('old-access-a6', 'a6:old-access:' || gen_random_uuid()::text, 'A6 test old access'),
  vault.create_secret('old-refresh-a6', 'a6:old-refresh:' || gen_random_uuid()::text, 'A6 test old refresh');

insert into private.meli_oauth_credentials(
  meli_account_id, access_secret_id, refresh_secret_id, expires_at, credential_version
)
select
  '26000000-0000-4000-8000-000000000001',
  access_id,
  refresh_id,
  now() - interval '1 minute',
  1
from a6_secret_ids;

select ok(
  public.backend_acquire_refresh_lease(
    '26000000-0000-4000-8000-000000000001',
    '36000000-0000-4000-8000-000000000001',
    1,
    30
  ),
  'first broker acquires refresh lease'
);

select ok(
  public.backend_stage_refresh_recovery(
    '26000000-0000-4000-8000-000000000001',
    '36000000-0000-4000-8000-000000000001',
    1,
    'new-access-a6',
    'new-refresh-a6',
    now() + interval '6 hours',
    array['read','write']
  ),
  'rotated pair is staged durably in Vault before canonical commit'
);

select is(
  (select expected_credential_version from private.meli_refresh_recovery
   where meli_account_id='26000000-0000-4000-8000-000000000001'),
  1::bigint,
  'staged recovery is tied to the expected credential version'
);

select is(
  (select refresh_token from public.backend_get_oauth_material('26000000-0000-4000-8000-000000000001')),
  'old-refresh-a6',
  'canonical refresh token remains unchanged until staged commit'
);

-- Simulate the first Edge invocation ending after the stage but before canonical commit.
select public.backend_release_refresh_lease(
  '26000000-0000-4000-8000-000000000001',
  '36000000-0000-4000-8000-000000000001'
);

select ok(
  public.backend_acquire_refresh_lease(
    '26000000-0000-4000-8000-000000000001',
    '36000000-0000-4000-8000-000000000002',
    1,
    30
  ),
  'next broker acquires the same credential version'
);

create temp table a6_commit_result on commit drop as
select * from public.backend_commit_staged_refresh(
  '26000000-0000-4000-8000-000000000001',
  '36000000-0000-4000-8000-000000000002',
  1
);

select is(
  (select access_token from a6_commit_result),
  'new-access-a6',
  'recovery commit returns the staged access token to the backend caller'
);

select is(
  (select credential_version from a6_commit_result),
  2::bigint,
  'recovery commit advances credential_version exactly once'
);

select is(
  (select refresh_token from public.backend_get_oauth_material('26000000-0000-4000-8000-000000000001')),
  'new-refresh-a6',
  'canonical Vault refresh secret now contains the rotated token'
);

select is(
  (select expected_credential_version from private.meli_refresh_recovery
   where meli_account_id='26000000-0000-4000-8000-000000000001'),
  null::bigint,
  'pending recovery metadata is cleared after commit'
);

select is(
  (select count(*)::int
   from private.meli_refresh_recovery r
   join vault.decrypted_secrets a on a.id=r.access_secret_id
   join vault.decrypted_secrets b on b.id=r.refresh_secret_id
   where r.meli_account_id='26000000-0000-4000-8000-000000000001'
     and a.decrypted_secret='consumed'
     and b.decrypted_secret='consumed'),
  1,
  'staging Vault slots are scrubbed after canonical commit'
);

select cmp_ok(
  (select count(*) from public.security_audit_log
   where meli_account_id='26000000-0000-4000-8000-000000000001'
     and action in ('oauth_refresh_staged','oauth_refresh_committed')),
  '>=',
  2::bigint,
  'staging and recovery commit are audited without token values'
);

select ok(
  public.backend_acquire_refresh_lease(
    '26000000-0000-4000-8000-000000000001',
    '36000000-0000-4000-8000-000000000003',
    2,
    30
  ),
  'a later broker can acquire the new canonical version'
);

select ok(
  public.backend_mark_refresh_persistence_failure(
    '26000000-0000-4000-8000-000000000001',
    '36000000-0000-4000-8000-000000000003',
    2,
    false,
    'refresh_result_unpersisted'
  ),
  'unrecoverable rotated-result loss is recorded atomically'
);

select is(
  (select status::text from public.meli_accounts
   where id='26000000-0000-4000-8000-000000000001'),
  'reconnect_required',
  'unrecoverable persistence loss never leaves the account falsely active'
);

select is(
  (select count(*)::int from public.security_audit_log
   where meli_account_id='26000000-0000-4000-8000-000000000001'
     and action='oauth_refresh_result_unpersisted'),
  1,
  'unrecoverable persistence loss is explicitly audited'
);

select * from finish();
rollback;
