import type { Comparator, MetricKey, MetricThresholds, ReputationRuleSet, ThresholdBand } from './types';

export const METRIC_KEYS: MetricKey[] = ['claims', 'cancellations', 'delayed_handling_time'];

/**
 * Resolves the reputation window.
 *
 * Runtime rule (section 4.1): never infer the window from a local sale count.
 * `metrics.*.period` from the official snapshot wins; the rule set is only a
 * fallback when no snapshot is available. This also neutralises the MLU
 * conflict between two official pages (25 vs 41 completed sales).
 */
export function resolveWindowDays(
  officialPeriod: string | null | undefined,
  ruleSet: ReputationRuleSet,
  localSalesInWindow: number | null,
): { windowDays: number; source: 'official_period' | 'rule_set_high' | 'rule_set_low' } {
  const parsed = parsePeriodDays(officialPeriod);
  if (parsed !== null) return { windowDays: parsed, source: 'official_period' };

  if (
    ruleSet.highVolumeWindowDays !== null &&
    ruleSet.highVolumeMinSales !== null &&
    localSalesInWindow !== null &&
    localSalesInWindow >= ruleSet.highVolumeMinSales
  ) {
    return { windowDays: ruleSet.highVolumeWindowDays, source: 'rule_set_high' };
  }
  return { windowDays: ruleSet.lowVolumeWindowDays, source: 'rule_set_low' };
}

/** Parses "60 days", "120 days", "365 days" and the ISO-ish variants seen in the wild. */
export function parsePeriodDays(period: string | null | undefined): number | null {
  if (!period) return null;
  const days = /(\d+)\s*d(ay|ays|ias|ías|ias)?\b/i.exec(period);
  if (days?.[1]) return Number(days[1]);
  const months = /(\d+)\s*m(onth|onths|es|eses)\b/i.exec(period);
  if (months?.[1]) return Number(months[1]) * 30;
  const years = /(\d+)\s*(year|years|año|anos|años)\b/i.exec(period);
  if (years?.[1]) return Number(years[1]) * 365;
  return null;
}

export function comparatorFor(ruleSet: ReputationRuleSet, metric: MetricKey): Comparator {
  return ruleSet.comparators[metric] ?? 'lte';
}

export function satisfies(rate: number, threshold: number, comparator: Comparator): boolean {
  return comparator === 'lt' ? rate < threshold : rate <= threshold;
}

/** Quality band for a rate. `red` means the orange threshold was crossed. */
export function bandFor(rate: number, thresholds: MetricThresholds, comparator: Comparator): ThresholdBand {
  if (satisfies(rate, thresholds.target, comparator)) return 'target';
  if (satisfies(rate, thresholds.green, comparator)) return 'green';
  if (satisfies(rate, thresholds.yellow, comparator)) return 'yellow';
  if (satisfies(rate, thresholds.orange, comparator)) return 'orange';
  return 'red';
}

/** The next threshold the account would cross if the rate got worse. */
export function nextThreshold(rate: number, thresholds: MetricThresholds, comparator: Comparator): number {
  const ladder = [thresholds.target, thresholds.green, thresholds.yellow, thresholds.orange];
  for (const threshold of ladder) {
    if (satisfies(rate, threshold, comparator)) return threshold;
  }
  return thresholds.orange;
}
