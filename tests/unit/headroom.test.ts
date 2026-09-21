import { describe, expect, it } from 'vitest';
import {
  headroomExisting,
  headroomFutureBadSales,
  healthySalesToRecover,
} from '@/lib/reputation/headroom';

describe('safety margins', () => {
  it('counts incidents tolerated over sales already in the denominator', () => {
    // 100 sales, 1 claim, threshold 3%: 2 more claims fit (3/100 = 3%).
    expect(headroomExisting(100, 1, 0.03)).toBe(2);
  });

  it('respects a strict comparator', () => {
    // With "<" the third claim reaches exactly 3% and no longer satisfies it.
    expect(headroomExisting(100, 1, 0.03, 'lt')).toBe(1);
  });

  it('counts new incidented sales, which move numerator and denominator', () => {
    // Each new bad sale adds to both sides, so the margin is larger than the
    // existing-sales margin. Conflating the two is the classic error.
    // Same denominator: the future margin is never smaller...
    expect(headroomFutureBadSales(100, 1, 0.03)).toBeGreaterThanOrEqual(headroomExisting(100, 1, 0.03));
    // ...and on a larger denominator the difference is strict.
    expect(headroomFutureBadSales(100, 0, 0.1)).toBeGreaterThan(headroomExisting(100, 0, 0.1));
  });

  it('computes healthy sales needed to recover', () => {
    // 5 claims over 100 sales is 5%; to reach 3% the denominator must be ~167.
    expect(healthySalesToRecover(100, 5, 0.03)).toBe(67);
  });

  it('returns zero when the rate is already under the threshold', () => {
    expect(healthySalesToRecover(100, 1, 0.03)).toBe(0);
  });

  it('never divides by zero on an empty denominator', () => {
    expect(headroomExisting(0, 0, 0.03)).toBe(0);
  });
});
