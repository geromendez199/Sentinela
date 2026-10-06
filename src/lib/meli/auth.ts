import 'server-only';
import { serverEnv } from '@/lib/env/server';
import { MeliError, MeliTokenResponseError } from './errors';
import { MELI_TOKEN_URL } from './site-config';
import { meliOAuthErrorSchema } from './schemas/oauth';
import { meliTokenResponseSchema } from './schemas/oauth';
import type { MeliTokenResponse } from './types/oauth';

async function postToken(form: Record<string, string>): Promise<MeliTokenResponse> {
  const response = await fetch(MELI_TOKEN_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      Accept: 'application/json',
    },
    body: new URLSearchParams(form).toString(),
    cache: 'no-store',
  });

  const payload: unknown = await response.json().catch(() => ({}));

  if (!response.ok) {
    const parsed = meliOAuthErrorSchema.safeParse(payload);
    const code = parsed.success ? (parsed.data.error ?? parsed.data.message ?? null) : null;
    // Never include the body: it can echo the code or the refresh token.
    throw new MeliError('oauth_token_request_failed', response.status, code, 'oauth');
  }

  const parsed = meliTokenResponseSchema.safeParse(payload);
  if (!parsed.success) {
    throw new MeliTokenResponseError(parsed.error.issues.map((issue) => ({
      field: issue.path.join('.'),
      code: issue.code,
    })));
  }
  return parsed.data;
}

/** Authorization Code Grant exchange (section 3.2). */
export async function exchangeAuthorizationCode(params: {
  code: string;
  redirectUri: string;
  codeVerifier?: string;
}): Promise<MeliTokenResponse> {
  const env = serverEnv();
  const form: Record<string, string> = {
    grant_type: 'authorization_code',
    client_id: env.MELI_APP_ID,
    client_secret: env.MELI_CLIENT_SECRET,
    code: params.code,
    redirect_uri: params.redirectUri,
  };
  if (params.codeVerifier) form.code_verifier = params.codeVerifier;
  return postToken(form);
}

/**
 * Refresh exchange. Only the token broker may call this: the refresh token is
 * rotating and single use, so a concurrent refresh can invalidate the session.
 */
export async function refreshAccessToken(refreshToken: string): Promise<MeliTokenResponse> {
  const env = serverEnv();
  return postToken({
    grant_type: 'refresh_token',
    client_id: env.MELI_APP_ID,
    client_secret: env.MELI_CLIENT_SECRET,
    refresh_token: refreshToken,
  });
}
