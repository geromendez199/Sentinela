import { describe, expect, it } from 'vitest';
import { computeTwin, incidentExpiries, type LocalIncident } from '@/lib/reputation/calculator';
import { project } from '@/lib/reputation/projections';
import type { OfficialSnapshot, ReputationRuleSet } from '@/lib/reputation/types';

const MLA: ReputationRuleSet = {
  id: 'mla',
  siteId: 'MLA',
  version: '2026-09-01',
  highVolumeWindowDays: 60,
  lowVolumeWindowDays: 365,
  highVolumeMinSales: 50,
  thresholds: {
    claims: { target: 0.01, green: 0.015, yellow: 0.03, orange: 0.06 },
    cancellations: { target: 0.005, green: 0.01, yellow: 0.025, orange: 0.03 },
    delayed_handling_time: { target: 0.08, green: 0.1, yellow: 0.15, orange: 0.22 },
  },
  comparators: {},
  verificationStatus: 'verified',
};

const NOW = new Date('2026-09-21T12:00:00Z');

function claim(daysAgo: number, affects = true): LocalIncident {
  return {
    metric: 'claims',
    countedAt: new Date(NOW.getTime() - daysAgo * 86_400_000).toISOString(),
    affectsReputation: affects,
    orderId: 1000 + daysAgo,
    estimatedExpiry: false,
  };
}

const official: OfficialSnapshot = {
  observedAt: NOW.toISOString(),
  levelId: '5_green',
  powerSellerStatus: 'gold',
  salesCompleted: 200,
  metrics: {
    claims: { period: '60 days', value: 3, rate: 0.015 },
    cancellations: { period: '60 days', value: 0, rate: 0 },
    delayed_handling_time: { period: '60 days', value: 0, rate: 0 },
  },
};

describe('calculated twin', () => {
  it('uses the official period as the window', () => {
    const twin = computeTwin({
      ruleSet: MLA,
      official,
      local: { eligibleSales: 200, incidents: [claim(10), claim(20), claim(30)] },
      consecutiveDriftSnapshots: 0,
      now: NOW,
    });
    expect(twin.windowDays).toBe(60);
    expect(twin.values.claims).toBe(3);
  });

  it('excludes incidents that already left the window', () => {
    const twin = computeTwin({
      ruleSet: MLA,
      official,
      local: { eligibleSales: 200, incidents: [claim(10), claim(90)] },
      consecutiveDriftSnapshots: 0,
      now: NOW,
    });
    expect(twin.values.claims).toBe(1);
  });

  it('excludes claims the official endpoint says do not affect reputation', () => {
    const twin = computeTwin({
      ruleSet: MLA,
      official,
      local: { eligibleSales: 200, incidents: [claim(10), claim(11, false)] },
      consecutiveDriftSnapshots: 0,
      now: NOW,
    });
    expect(twin.values.claims).toBe(1);
  });

  it('reports drift instead of hiding a divergence from the official figure', () => {
    const twin = computeTwin({
      ruleSet: MLA,
      official,
      local: { eligibleSales: 200, incidents: [claim(1), claim(2), claim(3), claim(4), claim(5), claim(6), claim(7)] },
      consecutiveDriftSnapshots: 2,
      now: NOW,
    });
    const claimsDrift = twin.drift.find((entry) => entry.metric === 'claims');
    expect(claimsDrift?.valueDelta).toBe(4);
    expect(twin.fidelity).toBe('degraded');
  });

  it('exposes both safety margins per metric', () => {
    const twin = computeTwin({
      ruleSet: MLA,
      official,
      local: { eligibleSales: 200, incidents: [claim(10)] },
      consecutiveDriftSnapshots: 0,
      now: NOW,
    });
    const claims = twin.headroom.find((entry) => entry.metric === 'claims');
    expect(claims?.headroomFutureBadSales).toBeGreaterThanOrEqual(claims?.headroomExisting ?? 0);
  });

  it('orders incident expiries by the date that governs the metric', () => {
    const expiries = incidentExpiries([claim(30), claim(10)], 60);
    expect(Date.parse(expiries[0]!.expiresAt)).toBeLessThan(Date.parse(expiries[1]!.expiresAt));
  });
});

describe('projections', () => {
  it('always returns the three scenarios per horizon with their factors', () => {
    const points = project({
      ruleSet: MLA,
      metric: 'claims',
      currentValue: 3,
      currentDenominator: 200,
      expiries: [new Date(NOW.getTime() + 5 * 86_400_000).toISOString()],
      expectedDailySales: 4,
      expectedDailyIncidents: 0.1,
      conservativeDailyIncidents: 0.3,
      now: NOW,
    });

    expect(points).toHaveLength(9);
    const recovery = points.filter((point) => point.scenario === 'recovery');
    const conservative = points.filter((point) => point.scenario === 'conservative');
    expect(recovery.every((point) => point.factors.expectedIncidents === 0)).toBe(true);
    expect(conservative[0]!.projectedRate).toBeGreaterThanOrEqual(recovery[0]!.projectedRate);
  });
});
