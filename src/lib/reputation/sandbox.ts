import type { Comparator } from './types';
import { satisfies } from './rule-sets';
import { healthySalesToRecover } from './headroom';

export interface SandboxMetric { key: string; label: string; value: number; denominator: number; threshold: number; comparator: Comparator }
export function simulateMetric(metric: SandboxMetric, healthySales: number, additionalIncidents: number, incidentOnNewSale: boolean) {
  if (![metric.value,metric.denominator,healthySales,additionalIncidents].every(value => Number.isSafeInteger(value) && value >= 0) || !Number.isFinite(metric.threshold) || metric.threshold <= 0 || metric.threshold >= 1 || metric.denominator === 0 || healthySales > 100_000 || additionalIncidents > 10_000) return null;
  const value = metric.value + additionalIncidents;
  const denominator = metric.denominator + healthySales + (incidentOnNewSale ? additionalIncidents : 0);
  const rate = value / denominator;
  return { value, denominator, rate, withinThreshold: satisfies(rate, metric.threshold, metric.comparator), healthySalesToRecover: healthySalesToRecover(denominator,value,metric.threshold,metric.comparator) };
}
