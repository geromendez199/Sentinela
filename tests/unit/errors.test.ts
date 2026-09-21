import { describe, expect, it } from 'vitest';
import { MeliError, backoffMs, isRetryable, parseRetryAfter, sanitizeOAuthError } from '@/lib/meli/errors';

describe('error taxonomy', () => {
  it('treats 429 and 5xx as retryable, 4xx as terminal', () => {
    expect(isRetryable(new MeliError('x', 429, null, 'orders.get'))).toBe(true);
    expect(isRetryable(new MeliError('x', 503, null, 'orders.get'))).toBe(true);
    expect(isRetryable(new MeliError('x', 400, null, 'orders.get'))).toBe(false);
  });

  it('parses Retry-After in both documented forms', () => {
    expect(parseRetryAfter('30')).toBe(30_000);
    expect(parseRetryAfter(null)).toBeNull();
    expect(parseRetryAfter(new Date(Date.now() + 60_000).toUTCString())).toBeGreaterThan(0);
  });

  it('applies full jitter so retries never align into a storm', () => {
    const samples = Array.from({ length: 50 }, () => backoffMs(4));
    expect(Math.min(...samples)).toBeLessThan(Math.max(...samples));
    expect(Math.max(...samples)).toBeLessThanOrEqual(4000);
  });

  it('never leaks provider text out of an oauth error', () => {
    expect(sanitizeOAuthError(new MeliError('secret body', 400, 'invalid_grant', 'oauth'))).toBe(
      '400:invalid_grant',
    );
  });
});
