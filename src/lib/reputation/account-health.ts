import type { MetricHeadroom } from './types';

export interface AccountHealthInput {
  orders: number;
  claimsAffectingReputation: number;
  mediations: number;
  lateShipments: number;
  shippedOrders: number;
  sellerCancellations: number;
  trackedShipments: number;
  scannedOnTime: number;
  headroom?: MetricHeadroom[];
}

export interface AccountHealthMetric {
  value: number | null;
  numerator: number;
  denominator: number;
  available: boolean;
}

export interface AccountHealthResult {
  ahr: number | null;
  status: 'excellent' | 'healthy' | 'watch' | 'critical' | 'unknown';
  odr: AccountHealthMetric;
  lsr: AccountHealthMetric;
  cancellationRate: AccountHealthMetric;
  vtr: AccountHealthMetric;
  defectFreeSalesBuffer: number | null;
}

function rate(numerator: number, denominator: number): AccountHealthMetric {
  const safeNumerator = Math.max(0, numerator);
  const safeDenominator = Math.max(0, denominator);
  return {
    value: safeDenominator > 0 ? safeNumerator / safeDenominator : null,
    numerator: safeNumerator,
    denominator: safeDenominator,
    available: safeDenominator > 0,
  };
}

/**
 * Synthetic account health (0–1000). It is deliberately explainable: each
 * defect category subtracts points from a clean baseline and unavailable
 * categories do not get treated as zero risk.
 */
export function calculateAccountHealth(input: AccountHealthInput): AccountHealthResult {
  const odr = rate(input.claimsAffectingReputation + input.mediations, input.orders);
  const lsr = rate(input.lateShipments, input.shippedOrders);
  const cancellationRate = rate(input.sellerCancellations, input.orders);
  const vtr = rate(input.scannedOnTime, input.trackedShipments);
  const available = [odr, lsr, cancellationRate, vtr].filter((metric) => metric.available);

  if (available.length === 0) {
    return { ahr: null, status: 'unknown', odr, lsr, cancellationRate, vtr, defectFreeSalesBuffer: null };
  }

  const penalties = [
    { metric: odr, limit: 0.02, weight: 420 },
    { metric: lsr, limit: 0.08, weight: 220 },
    { metric: cancellationRate, limit: 0.02, weight: 220 },
    { metric: vtr, limit: 0.95, weight: 140, inverse: true },
  ];
  const health = 1000 - penalties.reduce((total, entry) => {
    if (!entry.metric.available || entry.metric.value === null) return total;
    const breach = entry.inverse
      ? Math.max(0, entry.limit - entry.metric.value) / entry.limit
      : Math.max(0, entry.metric.value - entry.limit) / entry.limit;
    return total + Math.min(1, breach) * entry.weight;
  }, 0);
  const ahr = Math.round(Math.max(0, Math.min(1000, health)));
  const status = ahr >= 850 ? 'excellent' : ahr >= 700 ? 'healthy' : ahr >= 500 ? 'watch' : 'critical';
  const headroom = input.headroom?.find((entry) => entry.metric === 'claims');

  return { ahr, status, odr, lsr, cancellationRate, vtr, defectFreeSalesBuffer: headroom?.headroomExisting ?? null };
}

export interface HealthScenario {
  addedClaims: number;
  addedCancellations: number;
  result: AccountHealthResult;
}

export function simulateAccountHealth(input: AccountHealthInput, addedClaims: number, addedCancellations = 0): HealthScenario {
  return {
    addedClaims,
    addedCancellations,
    result: calculateAccountHealth({
      ...input,
      claimsAffectingReputation: input.claimsAffectingReputation + Math.max(0, addedClaims),
      orders: input.orders + Math.max(0, addedClaims) + Math.max(0, addedCancellations),
      sellerCancellations: input.sellerCancellations + Math.max(0, addedCancellations),
    }),
  };
}
