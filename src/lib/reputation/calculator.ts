import { headroomExisting, headroomFutureBadSales, healthySalesToRecover } from './headroom';
import { METRIC_KEYS, bandFor, comparatorFor, nextThreshold, resolveWindowDays } from './rule-sets';
import type {
  MetricHeadroom,
  MetricKey,
  OfficialSnapshot,
  ReputationRuleSet,
  TwinResult,
} from './types';
import { reconcile } from './reconcile';

export interface LocalIncident {
  metric: MetricKey;
  /** The date that governs when the incident leaves the official window. */
  countedAt: string;
  /** Claims: the result of /claims/{id}/affects-reputation at time t. */
  affectsReputation: boolean;
  orderId: number | null;
  estimatedExpiry: boolean;
}

export interface LocalWindowInput {
  /** Locally eligible sales inside the window: the denominator. */
  eligibleSales: number;
  incidents: LocalIncident[];
  /** Denominator override per metric when eligibility differs (e.g. ME2-only for delays). */
  metricDenominators?: Partial<Record<MetricKey, number>>;
}

export interface TwinInput {
  ruleSet: ReputationRuleSet;
  official: OfficialSnapshot | null;
  local: LocalWindowInput;
  /** Consecutive snapshots where drift already exceeded tolerance. */
  consecutiveDriftSnapshots: number;
  now?: Date;
}

function denominatorFor(input: LocalWindowInput, metric: MetricKey): number {
  return input.metricDenominators?.[metric] ?? input.eligibleSales;
}

/**
 * Calculated twin. It never replaces the official snapshot: both are persisted
 * separately and any divergence is surfaced as drift, never hidden (rule 13).
 */
export function computeTwin(input: TwinInput): TwinResult {
  const { ruleSet, official, local } = input;
  const now = input.now ?? new Date();

  const { windowDays } = resolveWindowDays(
    official?.metrics.claims.period ?? null,
    ruleSet,
    local.eligibleSales,
  );

  const windowStart = new Date(now.getTime() - windowDays * 86_400_000);

  const values = {} as Record<MetricKey, number>;
  const rates = {} as Record<MetricKey, number>;
  const headroom: MetricHeadroom[] = [];

  for (const metric of METRIC_KEYS) {
    const denominator = denominatorFor(local, metric);
    const value = local.incidents.filter(
      (incident) =>
        incident.metric === metric &&
        incident.affectsReputation &&
        Date.parse(incident.countedAt) >= windowStart.getTime(),
    ).length;

    const rate = denominator > 0 ? value / denominator : 0;
    values[metric] = value;
    rates[metric] = rate;

    const thresholds = ruleSet.thresholds[metric];
    const comparator = comparatorFor(ruleSet, metric);
    const threshold = nextThreshold(rate, thresholds, comparator);

    headroom.push({
      metric,
      band: bandFor(rate, thresholds, comparator),
      rate,
      threshold,
      comparator,
      headroomExisting: headroomExisting(denominator, value, threshold, comparator),
      headroomFutureBadSales: headroomFutureBadSales(denominator, value, threshold, comparator),
      healthySalesToRecover: healthySalesToRecover(denominator, value, threshold, comparator),
    });
  }

  const { drift, fidelity } = reconcile({
    official,
    values,
    rates,
    denominator: local.eligibleSales,
    consecutiveDriftSnapshots: input.consecutiveDriftSnapshots,
  });

  return {
    windowDays,
    denominator: local.eligibleSales,
    values,
    rates,
    headroom,
    drift,
    fidelity,
  };
}

/** Incident expiry dates drive the projection engine. */
export function incidentExpiries(
  incidents: LocalIncident[],
  windowDays: number,
): Array<{ orderId: number | null; metric: MetricKey; expiresAt: string; estimated: boolean }> {
  return incidents
    .filter((incident) => incident.affectsReputation)
    .map((incident) => ({
      orderId: incident.orderId,
      metric: incident.metric,
      expiresAt: new Date(Date.parse(incident.countedAt) + windowDays * 86_400_000).toISOString(),
      estimated: incident.estimatedExpiry,
    }))
    .sort((a, b) => Date.parse(a.expiresAt) - Date.parse(b.expiresAt));
}
