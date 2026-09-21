import { describe, expect, it } from 'vitest';
import { createHash } from 'node:crypto';

/**
 * Event key derivation must match supabase/functions/meli-webhook/index.ts.
 * Notification idempotency is not resource idempotency: two topics can point at
 * the same order, and an old notification can arrive after a newer one.
 */
function eventKey(appId: string, payload: {
  _id?: string;
  topic: string;
  resource: string;
  user_id: number;
  sent?: string;
  actions?: string[];
}): string {
  if (payload._id) return `${appId}:${payload._id}`;
  return createHash('sha256')
    .update(
      `${payload.topic}|${payload.resource}|${payload.user_id}|${payload.sent ?? ''}|${[...(payload.actions ?? [])].sort().join(',')}`,
    )
    .digest('hex');
}

describe('webhook dedupe key', () => {
  const base = { topic: 'orders_v2', resource: '/orders/123', user_id: 99, sent: '2026-09-21T10:00:00Z' };

  it('uses the payload _id when MercadoLibre supplies one', () => {
    expect(eventKey('app-1', { ...base, _id: 'abc' })).toBe('app-1:abc');
  });

  it('is stable across action ordering', () => {
    expect(eventKey('app-1', { ...base, actions: ['b', 'a'] })).toBe(
      eventKey('app-1', { ...base, actions: ['a', 'b'] }),
    );
  });

  it('separates two topics pointing at the same resource', () => {
    expect(eventKey('app-1', base)).not.toBe(eventKey('app-1', { ...base, topic: 'shipments' }));
  });

  it('separates redeliveries with a different sent timestamp', () => {
    expect(eventKey('app-1', base)).not.toBe(
      eventKey('app-1', { ...base, sent: '2026-09-21T10:00:01Z' }),
    );
  });
});

describe('out-of-order protection', () => {
  /** Mirrors the `where source_last_updated <= excluded` guard in the upserts. */
  function applies(stored: string, incoming: string): boolean {
    return Date.parse(stored) <= Date.parse(incoming);
  }

  it('never rolls current state back to an older resource version', () => {
    expect(applies('2026-09-21T10:00:00Z', '2026-09-21T09:00:00Z')).toBe(false);
    expect(applies('2026-09-21T10:00:00Z', '2026-09-21T11:00:00Z')).toBe(true);
  });

  it('re-applies an identical version idempotently', () => {
    expect(applies('2026-09-21T10:00:00Z', '2026-09-21T10:00:00Z')).toBe(true);
  });
});
