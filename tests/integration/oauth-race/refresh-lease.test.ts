import { describe, expect, it } from 'vitest';

/**
 * Models the lease + credential_version CAS of the token broker (section 5.3).
 *
 * The invariant under test: 100 concurrent callers produce exactly one
 * POST /oauth/token. Because the MercadoLibre refresh token is rotating and
 * single use, a second concurrent refresh would invalidate the account.
 */
class FakeCredentialStore {
  private version = 1;
  private leaseOwner: string | null = null;
  private leaseUntil = 0;
  refreshCalls = 0;

  acquire(owner: string, expectedVersion: number, leaseMs: number, now: number): boolean {
    if (this.version !== expectedVersion) return false;
    if (this.leaseOwner !== null && this.leaseUntil > now) return false;
    this.leaseOwner = owner;
    this.leaseUntil = now + leaseMs;
    return true;
  }

  commit(owner: string, expectedVersion: number): boolean {
    if (this.leaseOwner !== owner || this.version !== expectedVersion) return false;
    this.version += 1;
    this.leaseOwner = null;
    this.leaseUntil = 0;
    return true;
  }

  get currentVersion(): number {
    return this.version;
  }

  async refresh(): Promise<void> {
    this.refreshCalls += 1;
    await new Promise((resolve) => setTimeout(resolve, 5));
  }
}

describe('concurrent refresh', () => {
  it('issues exactly one token request for 100 concurrent callers', async () => {
    const store = new FakeCredentialStore();
    const startingVersion = store.currentVersion;

    const callers = Array.from({ length: 100 }, async () => {
      const owner = crypto.randomUUID();
      if (!store.acquire(owner, startingVersion, 30_000, Date.now())) return 'waited';
      await store.refresh();
      store.commit(owner, startingVersion);
      return 'refreshed';
    });

    const results = await Promise.all(callers);
    expect(store.refreshCalls).toBe(1);
    expect(results.filter((result) => result === 'refreshed')).toHaveLength(1);
    expect(store.currentVersion).toBe(startingVersion + 1);
  });

  it('lets a later caller refresh once the lease expires', () => {
    const store = new FakeCredentialStore();
    const now = Date.now();
    expect(store.acquire('a', 1, 30_000, now)).toBe(true);
    expect(store.acquire('b', 1, 30_000, now + 1_000)).toBe(false);
    // An abandoned lease must not freeze the account forever.
    expect(store.acquire('b', 1, 30_000, now + 31_000)).toBe(true);
  });

  it('rejects a commit from a caller whose version moved', () => {
    const store = new FakeCredentialStore();
    store.acquire('a', 1, 30_000, Date.now());
    expect(store.commit('a', 1)).toBe(true);
    expect(store.commit('a', 1)).toBe(false);
  });
});
