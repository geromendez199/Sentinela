import { describe, expect, it } from 'vitest';
import { bandFor, nextThreshold, parsePeriodDays, resolveWindowDays } from '@/lib/reputation/rule-sets';
import type { ReputationRuleSet } from '@/lib/reputation/types';

const MLU: ReputationRuleSet = {
  id: 'mlu',
  siteId: 'MLU',
  version: '2026-09-01-conflict',
  highVolumeWindowDays: 120,
  lowVolumeWindowDays: 365,
  highVolumeMinSales: 25,
  thresholds: {
    claims: { target: 0.025, green: 0.035, yellow: 0.055, orange: 0.07 },
    cancellations: { target: 0.015, green: 0.025, yellow: 0.07, orange: 0.09 },
    delayed_handling_time: { target: 0.1, green: 0.12, yellow: 0.18, orange: 0.26 },
  },
  comparators: {},
  verificationStatus: 'conflict',
};

describe('reputation window resolution', () => {
  it('prefers the period reported by the official snapshot', () => {
    // This is what neutralises the MLU conflict between two official pages.
    expect(resolveWindowDays('60 days', MLU, 10)).toEqual({ windowDays: 60, source: 'official_period' });
  });

  it('falls back to the rule set only when no official period exists', () => {
    expect(resolveWindowDays(null, MLU, 30).source).toBe('rule_set_high');
    expect(resolveWindowDays(null, MLU, 5).source).toBe('rule_set_low');
  });

  it('parses the period formats seen in official responses', () => {
    expect(parsePeriodDays('365 days')).toBe(365);
    expect(parsePeriodDays('4 months')).toBe(120);
    expect(parsePeriodDays(null)).toBeNull();
  });
});

describe('quality bands', () => {
  it('maps a rate to its band', () => {
    expect(bandFor(0.02, MLU.thresholds.claims, 'lte')).toBe('target');
    expect(bandFor(0.03, MLU.thresholds.claims, 'lte')).toBe('green');
    expect(bandFor(0.08, MLU.thresholds.claims, 'lte')).toBe('red');
  });

  it('returns the next threshold the account would cross', () => {
    expect(nextThreshold(0.03, MLU.thresholds.claims, 'lte')).toBe(0.035);
  });
});
