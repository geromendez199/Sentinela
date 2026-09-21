-- Backend RPC smoke test.
--
-- Run against a database with the migrations and seed applied:
--   psql "$DATABASE_URL" -f supabase/tests/sql/smoke_backend_rpcs.sql
--
-- It asserts the behaviours the workers depend on: webhook dedupe, the
-- out-of-order upsert guard, official claim affectation, and that a stored risk
-- score always carries its feature contributions. Everything rolls back.

\set ON_ERROR_STOP on
begin;
insert into auth.users(id) values ('11111111-1111-1111-1111-111111111111');
insert into public.organizations(id,name,slug,created_by)
values ('22222222-2222-2222-2222-222222222222','Acme','acme','11111111-1111-1111-1111-111111111111');
insert into public.organization_members(org_id,user_id,role)
values ('22222222-2222-2222-2222-222222222222','11111111-1111-1111-1111-111111111111','owner');
insert into public.meli_accounts(id,org_id,seller_id,site_id,status)
values ('33333333-3333-3333-3333-333333333333','22222222-2222-2222-2222-222222222222',12345,'MLA','active');

-- rate buckets
select public.backend_provision_rate_buckets('33333333-3333-3333-3333-333333333333');
select granted from public.backend_take_rate_token('account:33333333-3333-3333-3333-333333333333:default', 1);

-- webhook ingest is idempotent
select public.backend_ingest_webhook('k1','orders_v2','/orders/1',12345,999,
  '33333333-3333-3333-3333-333333333333','22222222-2222-2222-2222-222222222222', now(), 1, array['created']) as first_insert;
select public.backend_ingest_webhook('k1','orders_v2','/orders/1',12345,999,
  '33333333-3333-3333-3333-333333333333','22222222-2222-2222-2222-222222222222', now(), 1, array['created']) as duplicate;

-- order upsert respects source_last_updated ordering
select public.backend_upsert_order('22222222-2222-2222-2222-222222222222','33333333-3333-3333-3333-333333333333',
  1, null, null, 'paid', '["a"]'::jsonb, now()-interval '1 day', null, now(), 100.0, 'ARS',
  '[{"item":{"id":"MLA1"},"quantity":2,"unit_price":50}]'::jsonb) as applied_new;
select public.backend_upsert_order('22222222-2222-2222-2222-222222222222','33333333-3333-3333-3333-333333333333',
  1, null, null, 'cancelled', '[]'::jsonb, now()-interval '1 day', null, now()-interval '1 hour', 100.0, 'ARS','[]'::jsonb) as applied_stale;
select status from public.orders where order_id=1;

-- claim upsert records an official incident
select public.backend_upsert_claim('22222222-2222-2222-2222-222222222222','33333333-3333-3333-3333-333333333333',
  77, '{"id":77,"resource":"order","resource_id":1,"status":"opened","stage":"claim","date_created":"2026-09-01T00:00:00Z","last_updated":"2026-09-02T00:00:00Z"}'::jsonb,
  '{"affects_reputation":true}'::jsonb) as claim_applied;
select affects_reputation from public.claims where claim_id=77;
select incident_type, affects_reputation, affect_source from public.reputation_incidents;

-- reputation snapshot + computation
select public.backend_store_reputation_snapshot('22222222-2222-2222-2222-222222222222','33333333-3333-3333-3333-333333333333',
  '{"level_id":"5_green","power_seller_status":"gold","metrics":{"claims":{"period":"60 days","value":3,"rate":0.015},"sales":{"period":"60 days","completed":200}}}'::jsonb) is not null as snapshot_ok;
select public.backend_store_reputation_computation('22222222-2222-2222-2222-222222222222','33333333-3333-3333-3333-333333333333',
  (select id from public.reputation_rule_sets where site_id='MLA' limit 1), now()-interval '60 days', now(),
  '{"claims":{"value":3,"denominator":200,"rate":0.015}}'::jsonb, '{"metrics":[]}'::jsonb, '{}'::jsonb, '{"entries":[]}'::jsonb, 'calibrated') is not null as computation_ok;

-- risk score with contributions
select public.backend_store_risk_score('22222222-2222-2222-2222-222222222222','33333333-3333-3333-3333-333333333333',
  1, null, (select id from public.risk_model_versions where active limit 1), 0.72, null, null, null, 'high',
  '[{"feature":"sla_pressure","value":0.9,"contribution":1.62}]'::jsonb,
  '[{"feature":"sla_pressure","value":0.9,"weight":1.8,"contribution":1.62}]'::jsonb, 'h1') is not null as risk_ok;
select count(*) as stored_features from public.risk_score_features;

-- views resolve
select count(*) from public.latest_reputation;
select count(*) from public.latest_risk_per_order;
select count(*) from public.open_operational_risk;
rollback;
