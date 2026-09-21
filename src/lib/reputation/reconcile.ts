import { METRIC_KEYS } from './rule-sets';
import type { Fidelity, MetricKey, OfficialSnapshot, TwinDrift } from './types';

export interface ReconcileInput {
  official: OfficialSnapshot | null;
  values: Record<MetricKey, number>;
  rates: Record<MetricKey, number>;
  denominator: number;
  consecutiveDriftSnapshots: number;
}

/**
 * Drift detection (section 4.3). Tolerance scales with the denominator: one
 * extra incident on a small denominator is a large rate delta and must not be
 * read as a modelling error.
 */
export function rateTolerance(denominator: number): number {
  return Math.max(0.001, 1 / Math.max(denominator, 1));
}

export function reconcile(input: ReconcileInput): { drift: TwinDrift[]; fidelity: Fidelity } {
  if (!input.official) {
    return { drift: [], fidelity: 'initializing' };
  }

  const tolerance = rateTolerance(input.denominator);
  const drift: TwinDrift[] = [];

  for (const metric of METRIC_KEYS) {
    const official = input.official.metrics[metric];
    if (official.value === null && official.rate === null) continue;

    const valueDelta = (input.values[metric] ?? 0) - (official.value ?? 0);
    const rateDelta = (input.rates[metric] ?? 0) - (official.rate ?? 0);

    drift.push({
      metric,
      valueDelta,
      rateDelta,
      exceedsTolerance: Math.abs(valueDelta) > 1 || Math.abs(rateDelta) > tolerance,
    });
  }

  if (drift.length === 0) return { drift, fidelity: 'unknown' };

  const exceeded = drift.some((entry) => entry.exceedsTolerance);
  // Three consecutive snapshots outside tolerance degrade the twin and enqueue
  // an investigation; a single divergence is noise, not a model failure.
  const fidelity: Fidelity = exceeded && input.consecutiveDriftSnapshots + 1 >= 3 ? 'degraded' : 'calibrated';

  return { drift, fidelity };
}
