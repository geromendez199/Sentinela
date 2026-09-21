import { adminClient, rpc } from '../_shared/db.ts';
import { log } from '../_shared/logging.ts';
import { deleteMessage, readBatch, requeue } from '../_shared/queue.ts';

/**
 * Risk scoring worker (section 8.1).
 *
 * Explainable heuristic v0: normalized features, versioned weights, every
 * contribution persisted. It is a risk score, not a calibrated probability.
 *
 * Leakage guard: an open claim on the same order is never a feature for
 * predicting claim opening on that order.
 */

const QUEUE = 'derived_jobs';

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
]);

async function activeModel(orgId: string): Promise<ModelVersion | null> {
  const { data } = await adminClient()
    .from('risk_model_versions')
    .select('id, intercept, weights, thresholds, org_id')
    .eq('active', true)
    .or(`org_id.eq.${orgId},org_id.is.null`)
    // An org-specific model wins over the global baseline.
    .order('org_id', { ascending: false, nullsFirst: false })
    .limit(1);
  return (data?.[0] as ModelVersion | undefined) ?? null;
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

  const { data: shipment } = order.shipment_id
    ? await adminClient()
        .from('shipments')
        .select('substatus, logistic_type, expected_dispatch_at, sla_status, delivered_at')
        .eq('meli_account_id', job.meli_account_id)
        .eq('shipment_id', order.shipment_id)
        .maybeSingle()
    : { data: null };

  const { count: packOrders } = order.pack_id
    ? await adminClient()
        .from('orders')
        .select('order_id', { count: 'exact', head: true })
        .eq('meli_account_id', job.meli_account_id)
        .eq('pack_id', order.pack_id)
    : { count: 1 };

  const slaMinutes = shipment?.expected_dispatch_at
    ? (Date.parse(shipment.expected_dispatch_at) - Date.now()) / 60_000
    : null;

  // Buyer-message signals travel through the pack's messages, then their
  // classifications: ai_classifications is keyed by source, not by pack.
  const { data: packMessages } = order.pack_id
    ? await adminClient()
        .from('messages')
        .select('message_id, date_created, actor_role')
        .eq('meli_account_id', job.meli_account_id)
        .eq('pack_id', order.pack_id)
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

  // response_latency: minutes the newest buyer message has gone unanswered.
  const newestBuyerAt = (packMessages ?? [])[0]?.date_created ?? null;
  const { data: newestSeller } = order.pack_id
    ? await adminClient()
        .from('messages')
        .select('date_created')
        .eq('meli_account_id', job.meli_account_id)
        .eq('pack_id', order.pack_id)
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

  const slaPressure =
    slaMinutes === null
      ? shipment?.sla_status === 'delayed'
        ? 1
        : 0.3
      : ramp(slaMinutes, 1440, -120);

  return {
    sla_pressure: clamp01(slaPressure) * (shipment?.logistic_type === 'fulfillment' ? 0.5 : 1),
    shipment_exception:
      shipment?.substatus && EXCEPTION_SUBSTATUS.has(shipment.substatus.toLowerCase()) ? 0.7 : 0,
    stock_gap: 0.2,
    sku_claim_rate_z: rateZ(0, 0.02, 0.03),
    item_claim_rate_z: rateZ(0, 0.02, 0.03),
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
    capacity_pressure: 0,
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

  await rpc('backend_store_risk_score', {
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
    p_feature_hash: JSON.stringify(features).length.toString(36),
  });
}

Deno.serve(async (request) => {
  const body = (await request.json().catch(() => ({}))) as { batch_size?: number };
  const messages = await readBatch<Job>(QUEUE, 60, Math.min(100, body.batch_size ?? 50));

  let scored = 0;
  for (const entry of messages) {
    if (entry.message.job !== 'risk_score') continue;
    try {
      await scoreJob(entry.message);
      await deleteMessage(QUEUE, entry.msg_id);
      scored += 1;
    } catch (error) {
      log('warn', 'risk_score_failed', { error: String(error) });
      if (entry.read_ct >= 5) await deleteMessage(QUEUE, entry.msg_id);
      else await requeue(QUEUE, entry.msg_id, 30 * entry.read_ct);
    }
  }

  return new Response(JSON.stringify({ scored }), { headers: { 'Content-Type': 'application/json' } });
});
