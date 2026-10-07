import { describe, expect, it } from 'vitest';
import { CircuitBreaker, CircuitOpenError, fullJitterDelay } from '@/lib/meli/circuit-breaker';

describe('Mercado Libre circuit breaker', () => {
  it('opens after the failure threshold and permits a single half-open probe', () => {
    let now = 1_000;
    const breaker = new CircuitBreaker({ failureThreshold: 3, cooldownMs: 5_000, now: () => now });

    breaker.recordFailure('account');
    breaker.recordFailure('account');
    expect(() => breaker.beforeRequest('account')).not.toThrow();
    breaker.recordFailure('account');

    expect(() => breaker.beforeRequest('account')).toThrow(CircuitOpenError);
    now += 5_000;
    expect(() => breaker.beforeRequest('account')).not.toThrow();
    expect(() => breaker.beforeRequest('account')).toThrow(CircuitOpenError);

    breaker.recordSuccess('account');
    expect(() => breaker.beforeRequest('account')).not.toThrow();
  });

  it('uses capped full jitter', () => {
    expect(fullJitterDelay(1, () => 0.5, 400, 8_000)).toBe(200);
    expect(fullJitterDelay(20, () => 0.5, 400, 8_000)).toBe(4_000);
  });
});
