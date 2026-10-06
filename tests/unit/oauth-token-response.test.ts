import { afterEach, describe, expect, it, vi } from 'vitest';
import { exchangeAuthorizationCode } from '@/lib/meli/auth';
import { MeliTokenResponseError, sanitizeOAuthError } from '@/lib/meli/errors';

vi.mock('@/lib/env/server', () => ({ serverEnv: () => ({ MELI_APP_ID: '123456', MELI_CLIENT_SECRET: 'test-client-secret' }) }));
afterEach(() => vi.unstubAllGlobals());

describe('OAuth token response diagnostics', () => {
  it('reports a missing refresh token without exposing the response credentials', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => Response.json({ access_token: 'sensitive-access-token', token_type: 'Bearer', expires_in: 21600, scope: 'read', user_id: 123 })));
    const error = await exchangeAuthorizationCode({ code: 'sensitive-code', redirectUri: 'https://example.test/callback' }).catch((error: unknown) => error);
    expect(error).toBeInstanceOf(MeliTokenResponseError);
    expect(sanitizeOAuthError(error)).toBe('invalid_token_response:refresh_token:invalid_type');
    expect(JSON.stringify(error)).not.toContain('sensitive');
  });

  it('accepts a complete response and preserves the provider TTL', async () => {
    const response = { access_token: 'test-access-token', refresh_token: 'test-refresh-token', token_type: 'Bearer', expires_in: 10800, scope: 'read offline_access', user_id: 123 };
    vi.stubGlobal('fetch', vi.fn(async () => Response.json(response)));
    expect(await exchangeAuthorizationCode({ code: 'test-code', redirectUri: 'https://example.test/callback' })).toEqual(response);
  });
});
