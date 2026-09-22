import { adminClient, rpc } from '../_shared/db.ts';
import { requireInternalInvocation } from '../_shared/internal-auth.ts';
import { MeliClient } from '../_shared/meli-client.ts';
import { log } from '../_shared/logging.ts';

/**
 * Reputation reconciliation (sections 4.3 and 6.4).
 *
 * Two layers stay separate: the official observed snapshot from
 * GET /users/{id}.seller_reputation, and the calculated twin. Divergence is
 * recorded as drift and degrades fidelity; the official figure is never
 * overwritten by the calculation.
 */

const METRICS = ['claims', 'cancellations', 'delayed_handling_time'] as const;
type Metric = (typeof METRICS)[number];

interface RuleSet {
  id: string;
  site_id: string;
  thresholds: Record<Metric, { target: number; green: number; yellow: number; orange: number }>;
  comparators: Partial<Record<Metric, 'lt' | 'lte'>>;
  high_volume_window_days: number | null;
  low_volume_window_days: number;
  high_volume_min_sales: number | null;
}

function parsePeriodDays(period: string | null | undefined): number | null {
  if (!period) return null;
  const days = /(\d+)\s*d/i.exec(period);
  if (days?.[1]) return Number(days[1]);
  const months = /(\d+)\s*m/i.exec(period);
  if (months?.[1]) return Number(months[1]) * 30;
  return null;
}

function satisfies(rate: number, threshold: number, comparator: 'lt' | 'lte'): boolean {
  return comparator === 'lt' ? rate < threshold : rate <= threshold;
}

function nextThreshold(
  rate: number,
  thresholds: { target: number; green: number; yellow: number; orange: number },
  comparator: 'lt' | 'lte',
): number {
  for (const threshold of [thresholds.target, thresholds.green, thresholds.yellow, thresholds.orange]) {
    if (satisfies(rate, threshold, comparator)) return threshold;
  }
  return thresholds.orange;
}

function headroomExisting(n: number, v: number, threshold: number, comparator: 'lt' | 'lte'): number {
  const denominator = Math.max(n, 1);
  for (let k = 0; k < 100_000; k++) {
    if (!satisfies((v + k + 1) / denominator, threshold, comparator)) return k;
  }
  return 100_000;
}

function headroomFuture(n: number, v: number, threshold: number, comparator: 'lt' | 'lte'): number {
  for (let k = 0; k < 100_000; k++) {
    if (!satisfies((v + k + 1) / (n + k + 1), threshold, comparator)) return k;
  }
  return 100_000;
}

function healthyToRecover(n: number, v: number, threshold: number, comparator: 'lt' | 'lte'): number {
  if (threshold <= 0) return v > 0 ? 1_000_000 : 0;
  for (let k = 0; k <= 1_000_000; k++) {
    if (satisfies(v / (n + k), threshold, comparator)) return k;
  }
  return 1_000_000;
}

async function reconcileAccount(account: { id: string; org_id: string; site_id: string }): Promise<void> {
  const client = new MeliClient(account.id);

  const { data: accountRow } = await adminClient()
    .from('meli_accounts')
    .select('seller_id')
    .eq('id', account.id)
    .maybeSingle();
  if (!accountRow) return;

  const user = await client.get<{ seller_reputation?: Record<string, unknown> }>(
    `/users/${accountRow.seller_id}`,
    { endpointClass: 'users.get' },
  );
  const reputation = user.seller_reputation;
  if (!reputation) return;

  await rpc('backend_store_reputation_snapshot', {
    p_org_id: account.org_id,
    p_account_id: account.id,
    p_reputation: reputation,
  });

  const { data: ruleSets } = await adminClient()
    .from('reputation_rule_sets')
    .select('*')
    .eq('site_id', account.site_id)
    .order('effective_from', { ascending: false })
    .limit(1);

  const ruleSet = (ruleSets?.[0] ?? null) as RuleSet | null;
  if (!ruleSet) return;

  const metrics = (reputation.metrics ?? {}) as Record<string, { period?: string; rate?: number; value?: number }>;

  const windowDays = parsePeriodDays(metrics.claims?.period) ?? ruleSet.low_volume_window_days;
  const windowStart = new Date(Date.now() - windowDays * 86_400_000).toISOString();
  const windowEnd = new Date().toISOString();

  const { count: denominator } = await adminClient()
    .from('orders')
    .select('order_id', { count: 'exact', head: true })
    .eq('meli_account_id', account.id)
    .gte('date_created', windowStart)
    .not('status', 'eq', 'cancelled');

  const eligible = denominator ?? 0;

  const localMetrics: Record<string, { value: number; denominator: number; rate: number }> = {};
  const headroom: Array<Record<string, unknown>> = [];
  const drift: Array<Record<string, unknown>> = [];

  for (const metric of METRICS) {
    const incidentType = metric === 'delayed_handling_time' ? 'delay' : metric === 'claims' ? 'claim' : 'cancellation';

    const { count } = await adminClient()
      .from('reputation_incidents')
      .select('id', { count: 'exact', head: true })
      .eq('meli_account_id', account.id)
      .eq('incident_type', incidentType)
      .eq('affects_reputation', true)
      .gte('occurred_at', windowStart);

    const value = count ?? 0;
    const rate = eligible > 0 ? value / eligible : 0;
    localMetrics[metric] = { value, denominator: eligible, rate };

    const comparator = ruleSet.comparators[metric] ?? 'lte';
    const threshold = nextThreshold(rate, ruleSet.thresholds[metric], comparator);

    headroom.push({
      metric,
      rate,
      threshold,
      comparator,
      headroomExisting: headroomExisting(eligible, value, threshold, comparator),
      headroomFutureBadSales: headroomFuture(eligible, value, threshold, comparator),
      healthySalesToRecover: healthyToRecover(eligible, value, threshold, comparator),
    });

    const official = metrics[metric];
    if (official?.value !== undefined || official?.rate !== undefined) {
      const valueDelta = value - (official.value ?? 0);
      const rateDelta = rate - (official.rate ?? 0);
      const tolerance = Math.max(0.001, 1 / Math.max(eligible, 1));
      drift.push({
        metric,
        valueDelta,
        rateDelta,
        exceedsTolerance: Math.abs(valueDelta) > 1 || Math.abs(rateDelta) > tolerance,
      });
    }
  }

  const { data: previous } = await adminClient()
    .from('reputation_computations')
    .select('drift, fidelity')
    .eq('meli_account_id', account.id)
    .order('computed_at', { ascending: false })
    .limit(2);

  const previousExceeded = (previous ?? []).filter((row) => {
    const entries = (row.drift as { entries?: Array<{ exceedsTolerance?: boolean }> } | null)?.entries ?? [];
    return entries.some((entry) => entry.exceedsTolerance === true);
  }).length;

  const exceedsNow = drift.some((entry) => entry.exceedsTolerance === true);
  const fidelity = drift.length === 0 ? 'initializing' : exceedsNow && previousExceeded >= 2 ? 'degraded' : 'calibrated';

  await rpc('backend_store_reputation_computation', {
    p_org_id: account.org_id,
    p_account_id: account.id,
    p_rule_set_id: ruleSet.id,
    p_window_start: windowStart,
    p_window_end: windowEnd,
    p_metrics: localMetrics,
    p_headroom: { metrics: headroom },
    p_projections: {},
    p_drift: { entries: drift },
    p_fidelity: fidelity,
  });

  log('info', 'reputation_reconciled', {
    meli_account_id: account.id,
    fidelity,
    window_days: windowDays,
  });
}

Deno.serve(async (request) => {
  const authError = await requireInternalInvocation(request);
  if (authError) return authError;

  const body = (await request.json().catch(() => ({}))) as { priority?: string };

  const query = adminClient()
    .from('meli_accounts')
    .select('id, org_id, site_id, status')
    .in('status', ['active', 'backfilling', 'degraded']);

  const { data: accounts } = await query.limit(body.priority === 'high_risk' ? 20 : 100);

  let reconciled = 0;
  for (const account of accounts ?? []) {
    try {
      await reconcileAccount(account);
      reconciled += 1;
    } catch (error) {
      log('warn', 'reputation_reconcile_failed', { meli_account_id: account.id, error: String(error) });
    }
  }

  return new Response(JSON.stringify({ reconciled }), {
    headers: { 'Content-Type': 'application/json' },
  });
});
