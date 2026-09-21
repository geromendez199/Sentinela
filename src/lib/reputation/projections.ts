import type { MetricKey, ReputationRuleSet } from './types';
import { comparatorFor, nextThreshold } from './rule-sets';
import { satisfies } from './rule-sets';

export type ScenarioName = 'base' | 'conservative' | 'recovery';
export type Horizon = 7 | 14 | 30;

export interface ProjectionInput {
  ruleSet: ReputationRuleSet;
  metric: MetricKey;
  currentValue: number;
  currentDenominator: number;
  /** Incident expiry timestamps inside the projection horizon. */
  expiries: string[];
  /** Robust moving average of daily eligible sales. */
  expectedDailySales: number;
  /** Expected new incidents per day from open high-risk orders (base scenario). */
  expectedDailyIncidents: number;
  /** p75/p90 incident expectation for the conservative scenario. */
  conservativeDailyIncidents: number;
  now?: Date;
}

export interface ProjectionPoint {
  horizonDays: Horizon;
  scenario: ScenarioName;
  projectedValue: number;
  projectedDenominator: number;
  projectedRate: number;
  threshold: number;
  withinThreshold: boolean;
  /** Factors shown in the UI: never a single number without context (section 4.4). */
  factors: {
    incidentsExpiring: number;
    expectedSales: number;
    expectedIncidents: number;
  };
}

const HORIZONS: Horizon[] = [7, 14, 30];

function expiringWithin(expiries: string[], now: Date, days: number): number {
  const limit = now.getTime() + days * 86_400_000;
  return expiries.filter((iso) => {
    const at = Date.parse(iso);
    return Number.isFinite(at) && at <= limit;
  }).length;
}

/**
 * Deterministic scenario projection. Not a statistical forecast: the UI shows
 * the driving factors and the twin fidelity alongside every number.
 */
export function project(input: ProjectionInput): ProjectionPoint[] {
  const now = input.now ?? new Date();
  const comparator = comparatorFor(input.ruleSet, input.metric);
  const thresholds = input.ruleSet.thresholds[input.metric];
  const points: ProjectionPoint[] = [];

  for (const horizonDays of HORIZONS) {
    const expiring = expiringWithin(input.expiries, now, horizonDays);
    const expectedSales = Math.round(input.expectedDailySales * horizonDays);

    const scenarios: Array<[ScenarioName, number]> = [
      ['base', input.expectedDailyIncidents * horizonDays],
      ['conservative', input.conservativeDailyIncidents * horizonDays],
      ['recovery', 0],
    ];

    for (const [scenario, rawIncidents] of scenarios) {
      const expectedIncidents = Math.round(rawIncidents);
      const projectedValue = Math.max(0, input.currentValue - expiring + expectedIncidents);
      // Expiring incidents also leave the denominator: their sale ages out of the window.
      const projectedDenominator = Math.max(1, input.currentDenominator - expiring + expectedSales);
      const projectedRate = projectedValue / projectedDenominator;
      const threshold = nextThreshold(input.currentValue / Math.max(input.currentDenominator, 1), thresholds, comparator);

      points.push({
        horizonDays,
        scenario,
        projectedValue,
        projectedDenominator,
        projectedRate,
        threshold,
        withinThreshold: satisfies(projectedRate, threshold, comparator),
        factors: { incidentsExpiring: expiring, expectedSales, expectedIncidents },
      });
    }
  }

  return points;
}
