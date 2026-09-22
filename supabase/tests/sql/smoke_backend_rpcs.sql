-- Backend RPC smoke test.
--
-- Runs both under `supabase test db` (pgTAP/pg_prove) and directly with psql.
-- It asserts the behaviours the workers depend on: webhook dedupe, the
-- out-of-order upsert guard, official claim affectation, and that a stored risk
-- score always carries its feature contributions. Everything rolls back.

\set ON_ERROR_STOP on
begin;
select plan(18);

insert into auth.users(id) values ('11111111-1111-1111-1111-111111111111');
insert into public.organizations(id,name,slug,created_by)
values ('22222222-2222-2222-2222-222222222222','Acme','acme','11111111-1111-1111-1111-111111111111');
insert into public.organization_members(org_id,user_id,role)
values ('22222222-2222-2222-2222-222222222222','11111111-1111-1111-1111-111111111111','owner');
insert into public.meli_accounts(id,org_id,seller_id,site_id,status)
values ('33333333-3333-3333-3333-333333333333','22222222-2222-2222-2222-222222222222',12345,'MLA','active');

-- rate buckets
select public.backend_provision_rate_buckets('33333333-3333-3333-3333-333333333333');
select ok(
  (select granted from public.backend_take_rate_token('account:33333333-3333-3333-3333-333333333333:default', 1) limit 1),
  'provisioned account rate bucket grants a token'
);

-- webhook ingest is idempotent
select is(
  public.backend_ingest_webhook('k1','orders_v2','/orders/1',12345,999,
    '33333333-3333-3333-3333-333333333333','22222222-2222-2222-2222-222222222222', now(), 1, array['created']),
  true,
  'first webhook insert is accepted'
);
select is(
  public.backend_ingest_webhook('k1','orders_v2','/orders/1',12345,999,
    '33333333-3333-3333-3333-333333333333','22222222-2222-2222-2222-222222222222', now(), 1, array['created']),
  false,
  'duplicate webhook is rejected by dedupe'
);

-- order upsert respects source_last_updated ordering
select is(
  public.backend_upsert_order('22222222-2222-2222-2222-222222222222','33333333-3333-3333-3333-333333333333',
    1, null, null, 'paid', '["a"]'::jsonb, now()-interval '1 day', null, now(), 100.0, 'ARS',
    '[{"item":{"id":"MLA1"},"quantity":2,"unit_price":50}]'::jsonb),
  true,
  'new order state is applied'
);
select is(
  public.backend_upsert_order('22222222-2222-2222-2222-222222222222','33333333-3333-3333-3333-333333333333',
    1, null, null, 'cancelled', '[]'::jsonb, now()-interval '1 day', null, now()-interval '1 hour', 100.0, 'ARS','[]'::jsonb),
  false,
  'stale order state is rejected'
);
select is((select status from public.orders where order_id=1), 'paid', 'stale order did not roll current state backwards');

-- claim upsert records an official incident
select is(
  public.backend_upsert_claim('22222222-2222-2222-2222-222222222222','33333333-3333-3333-3333-333333333333',
    77, '{"id":77,"resource":"order","resource_id":1,"status":"opened","stage":"claim","date_created":"2026-09-01T00:00:00Z","last_updated":"2026-09-02T00:00:00Z"}'::jsonb,
    '{"affects_reputation":true}'::jsonb),
  true,
  'claim upsert is applied'
);
select is((select affects_reputation from public.claims where claim_id=77), 'affected', 'official affects-reputation state is stored');
select is((select incident_type::text from public.reputation_incidents where claim_id=77), 'claim', 'claim incident is created');
select ok((select affects_reputation from public.reputation_incidents where claim_id=77), 'official claim incident affects reputation');
select is((select affect_source from public.reputation_incidents where claim_id=77), 'official', 'official endpoint is retained as affectation source');

-- reputation snapshot + computation
select ok(
  public.backend_store_reputation_snapshot('22222222-2222-2222-2222-222222222222','33333333-3333-3333-3333-333333333333',
    '{"level_id":"5_green","power_seller_status":"gold","metrics":{"claims":{"period":"60 days","value":3,"rate":0.015},"sales":{"period":"60 days","completed":200}}}'::jsonb) is not null,
  'reputation snapshot is stored'
);
select ok(
  public.backend_store_reputation_computation('22222222-2222-2222-2222-222222222222','33333333-3333-3333-3333-333333333333',
    (select id from public.reputation_rule_sets where site_id='MLA' limit 1), now()-interval '60 days', now(),
    '{"claims":{"value":3,"denominator":200,"rate":0.015}}'::jsonb, '{"metrics":[]}'::jsonb, '{}'::jsonb, '{"entries":[]}'::jsonb, 'calibrated') is not null,
  'reputation computation is stored'
);

-- risk score with contributions
select ok(
  public.backend_store_risk_score('22222222-2222-2222-2222-222222222222','33333333-3333-3333-3333-333333333333',
    1, null, (select id from public.risk_model_versions where active limit 1), 0.72, null, null, null, 'high',
    '[{"feature":"sla_pressure","value":0.9,"contribution":1.62}]'::jsonb,
    '[{"feature":"sla_pressure","value":0.9,"weight":1.8,"contribution":1.62}]'::jsonb, 'h1') is not null,
  'risk score is stored'
);
select is((select count(*)::int from public.risk_score_features), 1, 'risk score stores its feature contribution');

-- security_invoker/read-model views resolve
select is((select count(*)::int from public.latest_reputation), 1, 'latest_reputation resolves one row');
select is((select count(*)::int from public.latest_risk_per_order), 1, 'latest_risk_per_order resolves one row');
select is((select count(*)::int from public.open_operational_risk), 1, 'open_operational_risk resolves one high-risk open order');

select * from finish();
rollback;
