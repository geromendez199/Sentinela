-- Sentinela ML - idempotent upserts for MercadoLibre current state.
--
-- Every upsert is guarded by the external last_updated: an out-of-order webhook
-- delivery must never roll current state backwards (section 6.3). History rows
-- are append-only and deduplicated by their natural key.

create or replace function public.backend_upsert_order(
  p_org_id uuid,
  p_account_id uuid,
  p_order_id bigint,
  p_pack_id bigint,
  p_shipment_id bigint,
  p_status text,
  p_tags jsonb,
  p_date_created timestamptz,
  p_date_closed timestamptz,
  p_source_last_updated timestamptz,
  p_total_amount numeric,
  p_currency_id text,
  p_order_items jsonb
)
returns boolean
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_applied boolean := false;
  v_item jsonb;
begin
  insert into public.orders(
    org_id, meli_account_id, order_id, pack_id, shipment_id, status, tags,
    date_created, date_closed, source_last_updated, currency_id, total_amount, last_synced_at
  )
  values (
    p_org_id, p_account_id, p_order_id, p_pack_id, p_shipment_id, p_status,
    coalesce((select array_agg(value::text) from jsonb_array_elements_text(coalesce(p_tags,'[]'::jsonb))), '{}'),
    coalesce(p_date_created, now()), p_date_closed, p_source_last_updated,
    p_currency_id, p_total_amount, now()
  )
  on conflict (meli_account_id, order_id) do update
  set pack_id = excluded.pack_id,
      shipment_id = excluded.shipment_id,
      status = excluded.status,
      tags = excluded.tags,
      date_closed = excluded.date_closed,
      source_last_updated = excluded.source_last_updated,
      currency_id = excluded.currency_id,
      total_amount = excluded.total_amount,
      last_synced_at = now()
  where public.orders.source_last_updated <= excluded.source_last_updated;

  get diagnostics v_applied = row_count;

  if v_applied then
    for v_item in select * from jsonb_array_elements(coalesce(p_order_items, '[]'::jsonb)) loop
      insert into public.order_items(
        org_id, meli_account_id, order_id, item_id, variation_id, user_product_id, quantity, unit_price
      )
      values (
        p_org_id, p_account_id, p_order_id,
        coalesce(v_item->'item'->>'id', 'unknown'),
        nullif(v_item->'item'->>'variation_id','')::bigint,
        nullif(v_item->>'user_product_id',''),
        greatest(1, coalesce((v_item->>'quantity')::integer, 1)),
        nullif(v_item->>'unit_price','')::numeric
      )
      on conflict (meli_account_id, order_id, item_id, variation_id, user_product_id) do nothing;
    end loop;
  end if;

  return v_applied;
end;
$$;

create or replace function public.backend_upsert_shipment(
  p_org_id uuid,
  p_account_id uuid,
  p_shipment_id bigint,
  p_shipment jsonb,
  p_sla jsonb default null
)
returns boolean
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_last_updated timestamptz := nullif(p_shipment->>'last_updated','')::timestamptz;
  v_applied boolean := false;
begin
  insert into public.shipments(
    org_id, meli_account_id, shipment_id, pack_id, status, substatus, mode, logistic_type,
    service_id, expected_dispatch_at, sla_status, sla_service, sla_last_updated,
    date_created, source_last_updated, shipped_at, delivered_at, raw_sanitized, last_synced_at
  )
  values (
    p_org_id, p_account_id, p_shipment_id,
    nullif(p_shipment->>'pack_id','')::bigint,
    p_shipment->>'status',
    p_shipment->>'substatus',
    p_shipment->>'mode',
    p_shipment->>'logistic_type',
    p_shipment->>'service_id',
    -- estimated_handling_limit is deprecated: expected_date is the contract.
    nullif(p_sla->>'expected_date','')::timestamptz,
    p_sla->>'status',
    p_sla->>'service',
    nullif(p_sla->>'last_updated','')::timestamptz,
    nullif(p_shipment->>'date_created','')::timestamptz,
    v_last_updated,
    nullif(p_shipment->'status_history'->>'date_shipped','')::timestamptz,
    nullif(p_shipment->'status_history'->>'date_delivered','')::timestamptz,
    jsonb_build_object(
      'mode', p_shipment->>'mode',
      'logistic_type', p_shipment->>'logistic_type',
      'substatus', p_shipment->>'substatus'
    ),
    now()
  )
  on conflict (meli_account_id, shipment_id) do update
  set pack_id = excluded.pack_id,
      status = excluded.status,
      substatus = excluded.substatus,
      mode = excluded.mode,
      logistic_type = excluded.logistic_type,
      service_id = excluded.service_id,
      expected_dispatch_at = coalesce(excluded.expected_dispatch_at, public.shipments.expected_dispatch_at),
      sla_status = coalesce(excluded.sla_status, public.shipments.sla_status),
      sla_service = coalesce(excluded.sla_service, public.shipments.sla_service),
      sla_last_updated = coalesce(excluded.sla_last_updated, public.shipments.sla_last_updated),
      source_last_updated = excluded.source_last_updated,
      shipped_at = coalesce(excluded.shipped_at, public.shipments.shipped_at),
      delivered_at = coalesce(excluded.delivered_at, public.shipments.delivered_at),
      raw_sanitized = excluded.raw_sanitized,
      last_synced_at = now()
  where public.shipments.source_last_updated is null
     or excluded.source_last_updated is null
     or public.shipments.source_last_updated <= excluded.source_last_updated;

  get diagnostics v_applied = row_count;

  -- History is append-only and deduplicated by its natural key.
  if p_shipment->>'status' is not null and v_last_updated is not null then
    insert into public.shipment_status_history(
      org_id, meli_account_id, shipment_id, status, substatus, event_at
    )
    values (
      p_org_id, p_account_id, p_shipment_id,
      p_shipment->>'status', p_shipment->>'substatus', v_last_updated
    )
    on conflict do nothing;
  end if;

  return v_applied;
end;
$$;

create or replace function public.backend_upsert_claim(
  p_org_id uuid,
  p_account_id uuid,
  p_claim_id bigint,
  p_claim jsonb,
  p_affects_reputation jsonb default null
)
returns boolean
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_last_updated timestamptz := coalesce(
    nullif(p_claim->>'last_updated','')::timestamptz,
    nullif(p_claim->>'date_created','')::timestamptz,
    now()
  );
  v_affects text;
  v_order_id bigint;
  v_applied boolean := false;
begin
  -- Only the official endpoint decides this; absence means "not consulted yet".
  if p_affects_reputation is not null then
    v_affects := case
      when (p_affects_reputation->>'affects_reputation')::boolean is true then 'affected'
      when (p_affects_reputation->>'affects_reputation')::boolean is false then 'not_affected'
      else null
    end;
  end if;

  if coalesce(p_claim->>'resource','order') = 'order' then
    v_order_id := nullif(p_claim->>'resource_id','')::bigint;
  end if;

  insert into public.claims(
    org_id, meli_account_id, claim_id, resource, resource_id, order_id, pack_id,
    type, stage, status, reason_id, affects_reputation, due_date, action_responsible,
    available_actions, date_created, source_last_updated, raw_sanitized, last_synced_at
  )
  values (
    p_org_id, p_account_id, p_claim_id,
    p_claim->>'resource',
    nullif(p_claim->>'resource_id','')::bigint,
    v_order_id,
    case when p_claim->>'resource' = 'pack' then nullif(p_claim->>'resource_id','')::bigint end,
    p_claim->>'type', p_claim->>'stage', p_claim->>'status',
    nullif(p_claim->>'reason_id',''),
    v_affects,
    nullif(p_claim->>'due_date','')::timestamptz,
    p_claim->>'action_responsible',
    coalesce((
      select array_agg(entry->>'action')
      from jsonb_array_elements(coalesce(p_claim->'available_actions','[]'::jsonb)) as entry
      where entry->>'action' is not null
    ), '{}'),
    nullif(p_claim->>'date_created','')::timestamptz,
    v_last_updated,
    jsonb_build_object('stage', p_claim->>'stage', 'type', p_claim->>'type'),
    now()
  )
  on conflict (meli_account_id, claim_id) do update
  set stage = excluded.stage,
      status = excluded.status,
      type = excluded.type,
      reason_id = coalesce(excluded.reason_id, public.claims.reason_id),
      -- A claim that was already classified keeps its label until reconsulted.
      affects_reputation = coalesce(excluded.affects_reputation, public.claims.affects_reputation),
      due_date = excluded.due_date,
      action_responsible = excluded.action_responsible,
      available_actions = excluded.available_actions,
      source_last_updated = excluded.source_last_updated,
      last_synced_at = now()
  where public.claims.source_last_updated <= excluded.source_last_updated;

  get diagnostics v_applied = row_count;

  -- Incidents are never deleted: their affectation state is updated in place.
  if v_affects is not null then
    insert into public.reputation_incidents(
      org_id, meli_account_id, order_id, claim_id, incident_type, occurred_at,
      affects_reputation, affect_source, projected_expiry_at, source_key
    )
    values (
      p_org_id, p_account_id, v_order_id, p_claim_id, 'claim',
      coalesce(nullif(p_claim->>'date_created','')::timestamptz, v_last_updated),
      v_affects = 'affected', 'official',
      coalesce(nullif(p_claim->>'date_created','')::timestamptz, v_last_updated) + interval '365 days',
      'claim:' || p_claim_id::text
    )
    on conflict (meli_account_id, incident_type, source_key) do update
    set affects_reputation = excluded.affects_reputation,
        affect_source = 'official',
        last_evaluated_at = now();
  end if;

  return v_applied;
end;
$$;

create or replace function public.backend_upsert_messages(
  p_org_id uuid,
  p_account_id uuid,
  p_pack_id bigint,
  p_conversation_status jsonb,
  p_messages jsonb
)
returns integer
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_message jsonb;
  v_seller_id bigint;
  v_role public.message_actor_role;
  v_count integer := 0;
begin
  select seller_id into v_seller_id from public.meli_accounts where id = p_account_id;

  for v_message in select * from jsonb_array_elements(coalesce(p_messages, '[]'::jsonb)) loop
    -- The post-sale architecture can place a MercadoLibre agent in the thread.
    v_role := case
      when lower(coalesce(v_message->'from'->>'role','')) in ('buyer','seller')
        then (lower(v_message->'from'->>'role'))::public.message_actor_role
      when lower(coalesce(v_message->'from'->>'role','')) in ('mediator','meli','agent') then 'meli_agent'
      when nullif(v_message->'from'->>'user_id','')::bigint = v_seller_id then 'seller'
      when v_message->'from'->>'user_id' is not null then 'buyer'
      else 'unknown'
    end;

    insert into public.messages(
      org_id, meli_account_id, message_id, pack_id, actor_role, text_sanitized,
      date_created, date_received, raw_sanitized
    )
    values (
      p_org_id, p_account_id, v_message->>'message_id', p_pack_id, v_role,
      v_message->>'text_sanitized',
      coalesce(
        nullif(v_message->'message_date'->>'created','')::timestamptz,
        nullif(v_message->'message_date'->>'received','')::timestamptz,
        now()
      ),
      nullif(v_message->'message_date'->>'received','')::timestamptz,
      jsonb_build_object('injection_suspected', coalesce((v_message->>'injection_suspected')::boolean, false))
    )
    on conflict (meli_account_id, message_id) do nothing;

    v_count := v_count + 1;
  end loop;

  if p_conversation_status is not null then
    update public.packs
    set raw_sanitized = jsonb_build_object(
          'conversation_status', p_conversation_status->>'status',
          'conversation_blocked', coalesce((p_conversation_status->>'blocked')::boolean, false)
        ),
        last_synced_at = now()
    where meli_account_id = p_account_id and pack_id = p_pack_id;
  end if;

  return v_count;
end;
$$;

create or replace function public.backend_upsert_item(
  p_org_id uuid,
  p_account_id uuid,
  p_item_id text,
  p_item jsonb
)
returns boolean
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_last_updated timestamptz := nullif(p_item->>'last_updated','')::timestamptz;
  v_applied boolean := false;
begin
  insert into public.items(
    org_id, meli_account_id, item_id, user_product_id, title, category_id, status,
    available_quantity, source_last_updated, raw_sanitized, last_synced_at
  )
  values (
    p_org_id, p_account_id, p_item_id,
    nullif(p_item->>'user_product_id',''),
    p_item->>'title', p_item->>'category_id', p_item->>'status',
    -- Not a stock source for multi-origin listings; user-products own that.
    nullif(p_item->>'available_quantity','')::integer,
    v_last_updated,
    jsonb_build_object('permalink', p_item->>'permalink'),
    now()
  )
  on conflict (meli_account_id, item_id) do update
  set title = excluded.title,
      category_id = excluded.category_id,
      status = excluded.status,
      available_quantity = excluded.available_quantity,
      user_product_id = coalesce(excluded.user_product_id, public.items.user_product_id),
      source_last_updated = excluded.source_last_updated,
      raw_sanitized = excluded.raw_sanitized,
      last_synced_at = now()
  where public.items.source_last_updated is null
     or excluded.source_last_updated is null
     or public.items.source_last_updated <= excluded.source_last_updated;

  get diagnostics v_applied = row_count;
  return v_applied;
end;
$$;

create or replace function public.backend_upsert_question(
  p_org_id uuid,
  p_account_id uuid,
  p_question_id bigint,
  p_question jsonb,
  p_text_sanitized text
)
returns boolean
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  insert into public.questions(
    org_id, meli_account_id, question_id, item_id, status, text_sanitized,
    date_created, answered_at, source_last_updated
  )
  values (
    p_org_id, p_account_id, p_question_id, p_question->>'item_id', p_question->>'status',
    p_text_sanitized,
    nullif(p_question->>'date_created','')::timestamptz,
    nullif(p_question->'answer'->>'date_created','')::timestamptz,
    now()
  )
  on conflict (meli_account_id, question_id) do update
  set status = excluded.status,
      text_sanitized = excluded.text_sanitized,
      answered_at = excluded.answered_at,
      source_last_updated = now();

  return true;
end;
$$;

-- ---------- reputation / risk persistence ----------
create or replace function public.backend_store_reputation_snapshot(
  p_org_id uuid,
  p_account_id uuid,
  p_reputation jsonb
)
returns uuid
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_id uuid;
begin
  insert into public.reputation_snapshots(
    org_id, meli_account_id, level_id, power_seller_status,
    sales_period, sales_completed,
    claims_period, claims_value, claims_rate,
    cancellations_period, cancellations_value, cancellations_rate,
    delay_period, delay_value, delay_rate,
    excluded, raw_sanitized
  )
  values (
    p_org_id, p_account_id,
    p_reputation->>'level_id',
    p_reputation->>'power_seller_status',
    p_reputation->'metrics'->'sales'->>'period',
    nullif(p_reputation->'metrics'->'sales'->>'completed','')::integer,
    p_reputation->'metrics'->'claims'->>'period',
    nullif(p_reputation->'metrics'->'claims'->>'value','')::integer,
    nullif(p_reputation->'metrics'->'claims'->>'rate','')::numeric,
    p_reputation->'metrics'->'cancellations'->>'period',
    nullif(p_reputation->'metrics'->'cancellations'->>'value','')::integer,
    nullif(p_reputation->'metrics'->'cancellations'->>'rate','')::numeric,
    p_reputation->'metrics'->'delayed_handling_time'->>'period',
    nullif(p_reputation->'metrics'->'delayed_handling_time'->>'value','')::integer,
    nullif(p_reputation->'metrics'->'delayed_handling_time'->>'rate','')::numeric,
    coalesce(p_reputation->'metrics'->'claims'->'excluded', '{}'::jsonb),
    jsonb_build_object('level_id', p_reputation->>'level_id')
  )
  returning id into v_id;

  update public.meli_accounts
  set power_seller_status = p_reputation->>'power_seller_status',
      level_id = p_reputation->>'level_id',
      last_reputation_sync_at = now(),
      last_api_ok_at = now(),
      updated_at = now()
  where id = p_account_id;

  return v_id;
end;
$$;

create or replace function public.backend_store_reputation_computation(
  p_org_id uuid,
  p_account_id uuid,
  p_rule_set_id uuid,
  p_window_start timestamptz,
  p_window_end timestamptz,
  p_metrics jsonb,
  p_headroom jsonb,
  p_projections jsonb,
  p_drift jsonb,
  p_fidelity public.fidelity_status
)
returns uuid
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_id uuid;
begin
  insert into public.reputation_computations(
    org_id, meli_account_id, rule_set_id, window_start, window_end,
    claims_value, claims_denominator, claims_rate,
    cancellations_value, cancellations_denominator, cancellations_rate,
    delay_value, delay_denominator, delay_rate,
    headroom, projections, drift, fidelity
  )
  values (
    p_org_id, p_account_id, p_rule_set_id, p_window_start, p_window_end,
    nullif(p_metrics->'claims'->>'value','')::integer,
    nullif(p_metrics->'claims'->>'denominator','')::integer,
    nullif(p_metrics->'claims'->>'rate','')::numeric,
    nullif(p_metrics->'cancellations'->>'value','')::integer,
    nullif(p_metrics->'cancellations'->>'denominator','')::integer,
    nullif(p_metrics->'cancellations'->>'rate','')::numeric,
    nullif(p_metrics->'delayed_handling_time'->>'value','')::integer,
    nullif(p_metrics->'delayed_handling_time'->>'denominator','')::integer,
    nullif(p_metrics->'delayed_handling_time'->>'rate','')::numeric,
    coalesce(p_headroom,'{}'::jsonb), coalesce(p_projections,'{}'::jsonb),
    coalesce(p_drift,'{}'::jsonb), p_fidelity
  )
  returning id into v_id;

  -- A degraded twin degrades the account, it does not hide the divergence.
  if p_fidelity = 'degraded' then
    update public.meli_accounts
    set status = case when status = 'active' then 'degraded' else status end,
        status_reason = coalesce(status_reason, 'twin_drift'),
        updated_at = now()
    where id = p_account_id;
  end if;

  return v_id;
end;
$$;

create or replace function public.backend_store_risk_score(
  p_org_id uuid,
  p_account_id uuid,
  p_order_id bigint,
  p_pack_id bigint,
  p_model_version_id uuid,
  p_risk numeric,
  p_claim_risk numeric,
  p_cancellation_risk numeric,
  p_delay_risk numeric,
  p_band text,
  p_explanations jsonb,
  p_features jsonb,
  p_feature_hash text
)
returns uuid
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_id uuid;
  v_feature jsonb;
begin
  insert into public.risk_scores(
    org_id, meli_account_id, order_id, pack_id, model_version_id, risk_probability,
    claim_risk, cancellation_risk, delay_risk, risk_band, explanations, feature_hash
  )
  values (
    p_org_id, p_account_id, p_order_id, p_pack_id, p_model_version_id, p_risk,
    p_claim_risk, p_cancellation_risk, p_delay_risk, p_band,
    coalesce(p_explanations,'[]'::jsonb), p_feature_hash
  )
  returning id into v_id;

  -- Every contribution is stored: a score without its features is not auditable.
  for v_feature in select * from jsonb_array_elements(coalesce(p_features,'[]'::jsonb)) loop
    insert into public.risk_score_features(
      risk_score_id, feature_name, normalized_value, weight, contribution, source
    )
    values (
      v_id,
      v_feature->>'feature',
      nullif(v_feature->>'value','')::numeric,
      nullif(v_feature->>'weight','')::numeric,
      nullif(v_feature->>'contribution','')::numeric,
      'heuristic_v0'
    )
    on conflict (risk_score_id, feature_name) do nothing;
  end loop;

  return v_id;
end;
$$;

revoke all on function public.backend_upsert_order(uuid,uuid,bigint,bigint,bigint,text,jsonb,timestamptz,timestamptz,timestamptz,numeric,text,jsonb) from public, anon, authenticated;
revoke all on function public.backend_upsert_shipment(uuid,uuid,bigint,jsonb,jsonb) from public, anon, authenticated;
revoke all on function public.backend_upsert_claim(uuid,uuid,bigint,jsonb,jsonb) from public, anon, authenticated;
revoke all on function public.backend_upsert_messages(uuid,uuid,bigint,jsonb,jsonb) from public, anon, authenticated;
revoke all on function public.backend_upsert_item(uuid,uuid,text,jsonb) from public, anon, authenticated;
revoke all on function public.backend_upsert_question(uuid,uuid,bigint,jsonb,text) from public, anon, authenticated;
revoke all on function public.backend_store_reputation_snapshot(uuid,uuid,jsonb) from public, anon, authenticated;
revoke all on function public.backend_store_reputation_computation(uuid,uuid,uuid,timestamptz,timestamptz,jsonb,jsonb,jsonb,jsonb,public.fidelity_status) from public, anon, authenticated;
revoke all on function public.backend_store_risk_score(uuid,uuid,bigint,bigint,uuid,numeric,numeric,numeric,numeric,text,jsonb,jsonb,text) from public, anon, authenticated;

grant execute on function public.backend_upsert_order(uuid,uuid,bigint,bigint,bigint,text,jsonb,timestamptz,timestamptz,timestamptz,numeric,text,jsonb) to service_role;
grant execute on function public.backend_upsert_shipment(uuid,uuid,bigint,jsonb,jsonb) to service_role;
grant execute on function public.backend_upsert_claim(uuid,uuid,bigint,jsonb,jsonb) to service_role;
grant execute on function public.backend_upsert_messages(uuid,uuid,bigint,jsonb,jsonb) to service_role;
grant execute on function public.backend_upsert_item(uuid,uuid,text,jsonb) to service_role;
grant execute on function public.backend_upsert_question(uuid,uuid,bigint,jsonb,text) to service_role;
grant execute on function public.backend_store_reputation_snapshot(uuid,uuid,jsonb) to service_role;
grant execute on function public.backend_store_reputation_computation(uuid,uuid,uuid,timestamptz,timestamptz,jsonb,jsonb,jsonb,jsonb,public.fidelity_status) to service_role;
grant execute on function public.backend_store_risk_score(uuid,uuid,bigint,bigint,uuid,numeric,numeric,numeric,numeric,text,jsonb,jsonb,text) to service_role;

-- ---------- job leasing ----------
create or replace function public.backend_claim_sync_job(p_lease_seconds integer default 300)
returns setof public.sync_jobs
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_owner uuid := gen_random_uuid();
begin
  -- A lease, not a held lock: the worker does HTTP work outside any transaction.
  return query
  update public.sync_jobs j
  set status = 'running',
      locked_by = v_owner,
      locked_until = now() + make_interval(secs => p_lease_seconds),
      attempts = j.attempts + 1,
      updated_at = now()
  where j.id = (
    select id from public.sync_jobs
    where status in ('queued','running')
      and next_run_at <= now()
      and (locked_until is null or locked_until < now())
    order by priority asc, created_at asc
    limit 1
    for update skip locked
  )
  returning j.*;
end;
$$;

revoke all on function public.backend_claim_sync_job(integer) from public, anon, authenticated;
grant execute on function public.backend_claim_sync_job(integer) to service_role;
