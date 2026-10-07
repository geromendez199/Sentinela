import { describe, expect, it } from 'vitest';
import { calculateAccountHealth, simulateAccountHealth } from '@/lib/reputation/account-health';

describe('synthetic account health', () => {
  it('keeps unavailable metrics explicit and returns a score from available data', () => {
    const result = calculateAccountHealth({ orders: 100, claimsAffectingReputation: 1, mediations: 0, lateShipments: 0, shippedOrders: 0, sellerCancellations: 1, trackedShipments: 0, scannedOnTime: 0 });
    expect(result.ahr).not.toBeNull();
    expect(result.lsr.available).toBe(false);
    expect(result.vtr.available).toBe(false);
    expect(result.odr.value).toBeCloseTo(0.01);
  });

  it('projects new defects without mutating the baseline', () => {
    const input = { orders: 100, claimsAffectingReputation: 0, mediations: 0, lateShipments: 0, shippedOrders: 100, sellerCancellations: 0, trackedShipments: 100, scannedOnTime: 100 };
    const before = calculateAccountHealth(input);
    const scenario = simulateAccountHealth(input, 5, 1);
    expect(scenario.result.ahr).toBeLessThan(before.ahr ?? 1000);
    expect(input.orders).toBe(100);
  });
});
