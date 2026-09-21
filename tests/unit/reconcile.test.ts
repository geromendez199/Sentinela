import { describe, expect, it } from 'vitest';
import { rateTolerance, reconcile } from '@/lib/reputation/reconcile';
import type { OfficialSnapshot } from '@/lib/reputation/types';

function snapshot(claimsValue: number, claimsRate: number): OfficialSnapshot {
  return {
    observedAt: new Date().toISOString(),
    levelId: '5_green',
    powerSellerStatus: 'platinum',
    salesCompleted: 500,
    metrics: {
      claims: { period: '60 days', value: claimsValue, rate: claimsRate },
      cancellations: { period: '60 days', value: 0, rate: 0 },
      delayed_handling_time: { period: '60 days', value: 0, rate: 0 },
    },
  };
}

describe('twin reconciliation', () => {
  it('scales tolerance with the denominator', () => {
    // On a small denominator one extra incident is a large rate delta.
    expect(rateTolerance(10)).toBeGreaterThan(rateTolerance(1000));
  });

  it('stays calibrated inside tolerance', () => {
    const result = reconcile({
      official: snapshot(5, 0.05),
      values: { claims: 5, cancellations: 0, delayed_handling_time: 0 },
      rates: { claims: 0.05, cancellations: 0, delayed_handling_time: 0 },
      denominator: 100,
      consecutiveDriftSnapshots: 0,
    });
    expect(result.fidelity).toBe('calibrated');
  });

  it('degrades only after three consecutive snapshots outside tolerance', () => {
    const input = {
      official: snapshot(5, 0.05),
      values: { claims: 12, cancellations: 0, delayed_handling_time: 0 },
      rates: { claims: 0.12, cancellations: 0, delayed_handling_time: 0 },
      denominator: 100,
    };

    expect(reconcile({ ...input, consecutiveDriftSnapshots: 0 }).fidelity).toBe('calibrated');
    expect(reconcile({ ...input, consecutiveDriftSnapshots: 2 }).fidelity).toBe('degraded');
  });

  it('reports initializing when no official snapshot exists yet', () => {
    const result = reconcile({
      official: null,
      values: { claims: 1, cancellations: 0, delayed_handling_time: 0 },
      rates: { claims: 0.01, cancellations: 0, delayed_handling_time: 0 },
      denominator: 100,
      consecutiveDriftSnapshots: 0,
    });
    expect(result.fidelity).toBe('initializing');
    expect(result.drift).toHaveLength(0);
  });
});
