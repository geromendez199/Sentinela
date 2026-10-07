import { adminClient, rpc } from '../_shared/db.ts';
import { requireInternalInvocation } from '../_shared/internal-auth.ts';
import { log } from '../_shared/logging.ts';
import { deadLetter, deleteMessage, readBatch, requeue } from '../_shared/queue.ts';
import { riskHistoryWindow } from '../_shared/risk-history.ts';

/**
 * Risk scoring worker (section 8.1).
 *
 * Explainable heuristic v0: normalized features, versioned weights, every
 * contribution persisted. It is a risk score, not a calibrated probability.
 *
 * Leakage guard: a claim on the order currently being scored is never used as
 * a predictor for that same order. Historical rates explicitly exclude it and
 * use only orders created before the order being scored.
 */

const QUEUE = 'risk_jobs';
const HISTORY_DAYS = 60;
const CAPACITY_DAYS = 7;
const HISTORY_SAMPLE_LIMIT = 1000;

interface Job {
  job: string;
  org_id: string;
  meli_account_id: string;
  order_id?: number;
  shipment_id?: number;
}

interface ModelVersion {
  id: string;
  intercept: number;
  weights: Record<string, number>;
  thresholds: { low: number; medium: number; high: number };
}

interface OrderContext {
  order_id: number;
  pack_id: number | null;
  shipment_id: number | null;
  status: string;
  date_created: string;
}

interface CurrentItem {
  item_id: string;
  user_product_id: string | null;
  seller_sku_hash: string | null;
}

const clamp01 = (value: number) => (Number.isFinite(value) ? Math.min(1, Math.max(0, value)) : 0);

function ramp(value: number, from: number, to: number): number {
  if (from === to) return value >= to ? 1 : 0;
  return clamp01((value - from) / (to - from));
}

function rateZ(rate: number, baseline: number, spread: number): number {
  if (spread <= 0) return rate > baseline ? 1 : 0;
  return clamp01(0.5 + (rate - baseline) / (2 * spread));
}

const EXCEPTION_SUBSTATUS = new Set([
  'delayed',
  'delivery_failed',
  'returning_to_sender',
  'lost',
  'damaged',
  'stale',
  'not_delivered',
  'shipment_stopped',
  'waiting_for_withdrawal',
]);

async function sha256Hex(value: string): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(value));
  return Array.from(new Uint8Array(digest))
    .map((byte) => byte.toString(16).padStart(2, '0'))
    .join('');
}

async function activeModel(orgId: string): Promise<ModelVersion | null> {
  const { data } = await adminClient()
    .from('risk_model_versions')
    .select('id, intercept, weights, thresholds, org_id')
    .eq('active', true)
    .or(`org_id.eq.${orgId},org_id.is.null`)
    .order('org_id', { ascending: false, nullsFirst: false })
    .limit(1);
  return (data?.[0] as ModelVersion | undefined) ?? null;
}

async function recentOrderIds(accountId: string, excludeOrderId: number, asOf: string): Promise<number[]> {
  const window = riskHistoryWindow(asOf, HISTORY_DAYS);
  const { data, error } = await adminClient()
    .from('orders')
    .select('order_id')
    .eq('meli_account_id', accountId)
    .gte('date_created', window.since)
    .lt('date_created', window.before)
    .neq('order_id', excludeOrderId)
    .order('date_created', { ascending: false })
    .limit(HISTORY_SAMPLE_LIMIT);
  if (error) throw new Error(`risk_history_orders_failed:${error.code ?? 'unknown'}`);
  return (data ?? []).map((row) => Number(row.order_id)).filter(Number.isFinite);
}

async function claimRateForOrders(accountId: string, orderIds: number[]): Promise<number | null> {
  if (orderIds.length === 0) return null;
  const { data, error } = await adminClient()
    .from('claims')
    .select('order_id')
    .eq('meli_account_id', accountId)
    .eq('affects_reputation', 'affected')
    .in('order_id', orderIds);
  if (error) throw new Error(`risk_history_claims_failed:${error.code ?? 'unknown'}`);
  const claimed = new Set((data ?? []).map((row) => Number(row.order_id)).filter(Number.isFinite));
  return claimed.size / orderIds.length;
}

async function itemAndSkuRates(
  accountId: string,
  current: CurrentItem | null,
  historyOrderIds: number[],
): Promise<{ itemRate: number | null; skuRate: number | null; categoryRate: number | null }> {
  if (!current || historyOrderIds.length === 0) return { itemRate: null, skuRate: null, categoryRate: null };

  const { data: rows, error } = await adminClient()
    .from('order_items')
    .select('order_id, item_id, seller_sku_hash')
    .eq('meli_account_id', accountId)
    .in('order_id', historyOrderIds)
    .limit(5000);
  if (error) throw new Error(`risk_history_items_failed:${error.code ?? 'unknown'}`);

  const itemOrders = new Set<number>();
  const skuOrders = new Set<number>();
  for (const row of rows ?? []) {
    const orderId = Number(row.order_id);
    if (row.item_id === current.item_id) itemOrders.add(orderId);
    if (current.seller_sku_hash && row.seller_sku_hash === current.seller_sku_hash) skuOrders.add(orderId);
  }

  const { data: itemRow } = await adminClient()
    .from('items')
    .select('category_id')
    .eq('meli_account_id', accountId)
    .eq('item_id', current.item_id)
    .maybeSingle();

  let categoryOrders = new Set<number>();
  if (itemRow?.category_id) {
    const { data: categoryItems } = await adminClient()
      .from('items')
      .select('item_id')
      .eq('meli_account_id', accountId)
      .eq('category_id', itemRow.category_id)
      .limit(250);
    const categoryItemIds = new Set((categoryItems ?? []).map((item) => String(item.item_id)));
    categoryOrders = new Set(
      (rows ?? [])
        .filter((row) => categoryItemIds.has(String(row.item_id)))
        .map((row) => Number(row.order_id)),
    );
  }

  const [itemRate, skuRate, categoryRate] = await Promise.all([
    claimRateForOrders(accountId, [...itemOrders]),
    claimRateForOrders(accountId, [...skuOrders]),
    claimRateForOrders(accountId, [...categoryOrders]),
  ]);
  return { itemRate, skuRate, categoryRate };
}

async function stockSignals(
  accountId: string,
  current: CurrentItem | null,
): Promise<{ published: number | null; operational: number | null; staleMinutes: number | null }> {
  if (!current) return { published: null, operational: null, staleMinutes: null };

  const { data: item } = await adminClient()
    .from('items')
    .select('available_quantity, user_product_id, last_synced_at')
    .eq('meli_account_id', accountId)
    .eq('item_id', current.item_id)
    .maybeSingle();

  const userProductId = current.user_product_id ?? item?.user_product_id ?? null;
  if (!userProductId) {
    return {
      published: item?.available_quantity ?? null,
      operational: item?.available_quantity ?? null,
      staleMinutes: item?.last_synced_at ? Math.max(0, (Date.now() - Date.parse(item.last_synced_at)) / 60_000) : null,
    };
  }

  const { data: stock } = await adminClient()
    .from('user_product_stock')
    .select('total_seller_stock, full_stock, last_synced_at')
    .eq('meli_account_id', accountId)
    .eq('user_product_id', userProductId)
    .maybeSingle();

  const operational = stock?.total_seller_stock ?? stock?.full_stock ?? null;
  return {
    published: item?.available_quantity ?? null,
    operational,
    staleMinutes: stock?.last_synced_at ? Math.max(0, (Date.now() - Date.parse(stock.last_synced_at)) / 60_000) : null,
  };
}

async function capacitySignals(accountId: string): Promise<{ pending: number; hourlyCapacity: number | null }> {
  const { count: pending, error: pendingError } = await adminClient()
    .from('orders')
    .select('order_id', { count: 'exact', head: true })
    .eq('meli_account_id', accountId)
    .in('status', ['confirmed', 'paid']);
  if (pendingError) throw new Error(`risk_pending_orders_failed:${pendingError.code ?? 'unknown'}`);

  const since = new Date(Date.now() - CAPACITY_DAYS * 86_400_000).toISOString();
  const { count: shipped, error: shippedError } = await adminClient()
    .from('shipments')
    .select('shipment_id', { count: 'exact', head: true })
    .eq('meli_account_id', accountId)
    .gte('shipped_at', since);
  if (shippedError) throw new Error(`risk_capacity_failed:${shippedError.code ?? 'unknown'}`);

  const hourlyCapacity = (shipped ?? 0) > 0 ? (shipped ?? 0) / (CAPACITY_DAYS * 24) : null;
  return { pending: pending ?? 0, hourlyCapacity };
}

async function buildFeatures(job: Job): Promise<Record<string, number> | null> {
  if (!job.order_id) return null;

  const { data: order } = await adminClient()
    .from('orders')
    .select('order_id, pack_id, shipment_id, status, date_created')
    .eq('meli_account_id', job.meli_account_id)
    .eq('order_id', job.order_id)
    .maybeSingle();
  if (!order) return null;
  const orderContext = order as OrderContext;

  const { data: shipment } = orderContext.shipment_id
    ? await adminClient()
        .from('shipments')
        .select('substatus, logistic_type, expected_dispatch_at, sla_status, delivered_at')
        .eq('meli_account_id', job.meli_account_id)
        .eq('shipment_id', orderContext.shipment_id)
        .maybeSingle()
    : { data: null };

  const { count: packOrders } = orderContext.pack_id
    ? await adminClient()
        .from('orders')
        .select('order_id', { count: 'exact', head: true })
        .eq('meli_account_id', job.meli_account_id)
        .eq('pack_id', orderContext.pack_id)
    : { count: 1 };

  const slaMinutes = shipment?.expected_dispatch_at
    ? (Date.parse(shipment.expected_dispatch_at) - Date.now()) / 60_000
    : null;

  const { data: packMessages } = orderContext.pack_id
    ? await adminClient()
        .from('messages')
        .select('message_id, date_created, actor_role')
        .eq('meli_account_id', job.meli_account_id)
        .eq('pack_id', orderContext.pack_id)
        .eq('actor_role', 'buyer')
        .order('date_created', { ascending: false })
        .limit(5)
    : { data: [] };

  const messageIds = (packMessages ?? []).map((row) => row.message_id);
  const { data: classifications } = messageIds.length
    ? await adminClient()
        .from('ai_classifications')
        .select('intent, urgency, sentiment, source_id, created_at')
        .eq('meli_account_id', job.meli_account_id)
        .eq('source_type', 'message')
        .in('source_id', messageIds)
        .order('created_at', { ascending: false })
        .limit(5)
    : { data: [] };

  const latest = (classifications ?? [])[0] as
    | { intent?: string; urgency?: number; sentiment?: number }
    | undefined;

  const newestBuyerAt = (packMessages ?? [])[0]?.date_created ?? null;
  const { data: newestSeller } = orderContext.pack_id
    ? await adminClient()
        .from('messages')
        .select('date_created')
        .eq('meli_account_id', job.meli_account_id)
        .eq('pack_id', orderContext.pack_id)
        .eq('actor_role', 'seller')
        .order('date_created', { ascending: false })
        .limit(1)
        .maybeSingle()
    : { data: null };

  const unansweredMinutes =
    newestBuyerAt &&
    (!newestSeller?.date_created || Date.parse(newestSeller.date_created) < Date.parse(newestBuyerAt))
      ? (Date.now() - Date.parse(newestBuyerAt)) / 60_000
      : null;

  const { data: computation } = await adminClient()
    .from('reputation_computations')
    .select('headroom')
    .eq('meli_account_id', job.meli_account_id)
    .order('computed_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  const headroomEntries =
    (computation?.headroom as { metrics?: Array<{ headroomExisting?: number }> } | null)?.metrics ?? [];
  const minHeadroom = headroomEntries.reduce(
    (min, entry) => Math.min(min, entry.headroomExisting ?? Number.POSITIVE_INFINITY),
    Number.POSITIVE_INFINITY,
  );

  const { data: currentItems } = await adminClient()
    .from('order_items')
    .select('item_id, user_product_id, seller_sku_hash')
    .eq('meli_account_id', job.meli_account_id)
    .eq('order_id', job.order_id)
    .limit(1);
  const currentItem = ((currentItems ?? [])[0] as CurrentItem | undefined) ?? null;

  const historyOrderIds = await recentOrderIds(
    job.meli_account_id,
    job.order_id,
    orderContext.date_created,
  );
  const [rates, stock, capacity] = await Promise.all([
    itemAndSkuRates(job.meli_account_id, currentItem, historyOrderIds),
    stockSignals(job.meli_account_id, currentItem),
    capacitySignals(job.meli_account_id),
  ]);

  const baseline = rates.categoryRate ?? (await claimRateForOrders(job.meli_account_id, historyOrderIds)) ?? 0;
  const stockGap =
    stock.published === null || stock.operational === null
      ? stock.staleMinutes === null
        ? 0.2
        : ramp(stock.staleMinutes, 60, 1440) * 0.6
      : ramp(stock.published - stock.operational, 0, Math.max(1, stock.published));

  const slaPressure =
    slaMinutes === null
      ? shipment?.sla_status === 'delayed'
        ? 1
        : 0.3
      : ramp(slaMinutes, 1440, -120);

  return {
    sla_pressure: clamp01(slaPressure) * (shipment?.logistic_type === 'fulfillment' ? 0.5 : 1),
    shipment_exception: clamp01(
      (shipment?.substatus && EXCEPTION_SUBSTATUS.has(shipment.substatus.toLowerCase()) ? 0.7 : 0) +
        (shipment?.sla_status === 'delayed' ? 0.3 : 0),
    ),
    stock_gap: clamp01(stockGap),
    sku_claim_rate_z: rateZ(rates.skuRate ?? 0, baseline, 0.03),
    item_claim_rate_z: rateZ(rates.itemRate ?? 0, baseline, 0.03),
    message_package_intent:
      latest?.intent === 'where_is_package' || latest?.intent === 'delivery_problem' ? 1 : 0,
    message_product_issue: ['product_defective', 'product_different', 'missing_parts', 'wrong_variant'].includes(
      latest?.intent ?? '',
    )
      ? 1
      : 0,
    urgency: clamp01(latest?.urgency ?? 0),
    negative_sentiment: clamp01(((latest?.sentiment ?? 0) * -1 + 1) / 2),
    response_latency: unansweredMinutes === null ? 0 : ramp(unansweredMinutes, 30, 720),
    capacity_pressure:
      capacity.hourlyCapacity && capacity.hourlyCapacity > 0
        ? ramp(capacity.pending / capacity.hourlyCapacity, 1, 6)
        : capacity.pending > 0
          ? 0.5
          : 0,
    account_headroom: Number.isFinite(minHeadroom) ? clamp01(1 - Math.min(minHeadroom, 10) / 10) : 0,
    pack_order_count: clamp01(((packOrders ?? 1) - 1) / 5),
  };
}

async function scoreJob(job: Job): Promise<void> {
  const model = await activeModel(job.org_id);
  if (!model) return;

  const features = await buildFeatures(job);
  if (!features) return;

  let logit = Number(model.intercept);
  const contributions: Array<Record<string, number | string>> = [];

  for (const [feature, weight] of Object.entries(model.weights)) {
    const value = features[feature] ?? 0;
    const contribution = Number(weight) * value;
    logit += contribution;
    contributions.push({ feature, value, weight: Number(weight), contribution });
  }

  const score = 1 / (1 + Math.exp(-logit));
  const band =
    score < model.thresholds.low
      ? 'low'
      : score < model.thresholds.medium
        ? 'medium'
        : score < model.thresholds.high
          ? 'high'
          : 'critical';

  contributions.sort((a, b) => Math.abs(Number(b.contribution)) - Math.abs(Number(a.contribution)));
  const featureHash = await sha256Hex(JSON.stringify(features));

  const riskScoreId = await rpc<string>('backend_store_risk_score', {
    p_org_id: job.org_id,
    p_account_id: job.meli_account_id,
    p_order_id: job.order_id ?? null,
    p_pack_id: null,
    p_model_version_id: model.id,
    p_risk: score,
    p_claim_risk: null,
    p_cancellation_risk: null,
    p_delay_risk: null,
    p_band: band,
    p_explanations: contributions.slice(0, 5),
    p_features: contributions,
    p_feature_hash: featureHash,
  });

  if ((band === 'high' || band === 'critical') && job.order_id) {
    await rpc('backend_raise_risk_alert', {
      p_org_id: job.org_id,
      p_account_id: job.meli_account_id,
      p_order_id: job.order_id,
      p_band: band,
      p_probability: score,
      p_risk_score_id: riskScoreId,
    });
  }
}

Deno.serve(async (request) => {
  const authError = await requireInternalInvocation(request);
  if (authError) return authError;

  const body = (await request.json().catch(() => ({}))) as { batch_size?: number };
  const messages = await readBatch<Job>(QUEUE, 60, Math.min(100, body.batch_size ?? 50));

  let scored = 0;
  let deadLettered = 0;
  for (const entry of messages) {
    try {
      if (entry.message.job !== 'risk_score') throw new Error('unexpected_job_kind');
      await scoreJob(entry.message);
      await deleteMessage(QUEUE, entry.msg_id);
      scored += 1;
    } catch (error) {
      const failure = error instanceof Error ? error.message : 'unknown_risk_error';
      log('warn', 'risk_score_failed', { failure_class: error instanceof Error ? error.name : 'UnknownError' });
      if (entry.read_ct >= 3) {
        await deadLetter(QUEUE, entry, error instanceof Error ? error.name : 'UnknownError', failure);
        deadLettered += 1;
      } else await requeue(QUEUE, entry.msg_id, 30 * entry.read_ct);
    }
  }

  return new Response(JSON.stringify({ scored, dead_lettered: deadLettered }), { headers: { 'Content-Type': 'application/json' } });
});
