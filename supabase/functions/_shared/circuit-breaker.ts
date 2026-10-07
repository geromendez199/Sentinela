export interface CircuitBreakerOptions {
  failureThreshold?: number;
  cooldownMs?: number;
  now?: () => number;
}

interface CircuitState {
  failures: number;
  openedAt: number | null;
  probeInFlight: boolean;
}

export class CircuitOpenError extends Error {
  constructor(readonly retryAfterMs: number) {
    super('meli_circuit_open');
    this.name = 'CircuitOpenError';
  }
}

/**
 * Small process-local circuit breaker. In serverless runtimes it protects each
 * warm worker immediately; the durable job queue remains the cross-instance
 * source of truth and retries work after the cooldown.
 */
export class CircuitBreaker {
  private readonly states = new Map<string, CircuitState>();
  private readonly failureThreshold: number;
  private readonly cooldownMs: number;
  private readonly now: () => number;

  constructor(options: CircuitBreakerOptions = {}) {
    this.failureThreshold = options.failureThreshold ?? 5;
    this.cooldownMs = options.cooldownMs ?? 60_000;
    this.now = options.now ?? Date.now;
  }

  beforeRequest(key: string): void {
    const state = this.states.get(key);
    if (!state || state.openedAt === null) return;

    const elapsed = this.now() - state.openedAt;
    if (elapsed < this.cooldownMs) throw new CircuitOpenError(this.cooldownMs - elapsed);
    if (state.probeInFlight) throw new CircuitOpenError(this.cooldownMs);
    state.probeInFlight = true;
  }

  recordSuccess(key: string): void {
    this.states.delete(key);
  }

  recordFailure(key: string): void {
    const state = this.states.get(key) ?? { failures: 0, openedAt: null, probeInFlight: false };
    state.failures += 1;
    state.probeInFlight = false;
    if (state.failures >= this.failureThreshold) state.openedAt = this.now();
    this.states.set(key, state);
  }
}

export function fullJitterDelay(attempt: number, random = Math.random, baseMs = 400, capMs = 8_000): number {
  const ceiling = Math.min(capMs, baseMs * 2 ** Math.max(0, attempt - 1));
  return Math.floor(random() * ceiling);
}
