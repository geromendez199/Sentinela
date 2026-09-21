import { NextResponse, type NextRequest } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { serverEnv } from '@/lib/env/server';
import { exchangeAuthorizationCode } from '@/lib/meli/auth';
import { sha256Hex } from '@/lib/meli/pkce';
import { MELI_API_BASE } from '@/lib/meli/site-config';
import { meliUserSchema } from '@/lib/meli/schemas';
import { logger } from '@/lib/observability/logger';
import { newCorrelationId } from '@/lib/observability/correlation';
import { sanitizeOAuthError } from '@/lib/meli/errors';

export const dynamic = 'force-dynamic';

interface LinkAttempt {
  id: string;
  org_id: string;
  user_id: string;
  site_id: string;
  redirect_uri: string;
  code_verifier: string | null;
}

function failure(request: NextRequest, reason: string) {
  // The reason is a stable code, never provider text that could carry the code.
  return NextResponse.redirect(new URL(`/?meli_link_error=${reason}`, request.url));
}

/**
 * Steps 6-14 of the linking flow (section 5.2). The state row is consumed
 * atomically, so a replayed callback cannot link an account twice.
 */
export async function GET(request: NextRequest) {
  const correlationId = newCorrelationId();
  const code = request.nextUrl.searchParams.get('code');
  const state = request.nextUrl.searchParams.get('state');

  if (!code || !state) return failure(request, 'missing_parameters');

  const supabase = createAdminClient();
  const stateHash = await sha256Hex(state);

  const { data: attemptData, error: attemptError } = await supabase.rpc(
    'backend_consume_oauth_link_attempt' as never,
    { p_state_hash: stateHash } as never,
  );

  if (attemptError) return failure(request, 'state_consume_failed');

  const rows = attemptData as unknown as LinkAttempt[] | LinkAttempt | null;
  const attempt = Array.isArray(rows) ? rows[0] : rows;
  if (!attempt) return failure(request, 'state_invalid_or_expired');

  let tokens;
  try {
    tokens = await exchangeAuthorizationCode({
      code,
      redirectUri: attempt.redirect_uri,
      ...(attempt.code_verifier ? { codeVerifier: attempt.code_verifier } : {}),
    });
  } catch (error) {
    logger.warn('oauth_code_exchange_failed', {
      correlation_id: correlationId,
      org_id: attempt.org_id,
      event: sanitizeOAuthError(error),
    });
    return failure(request, 'code_exchange_failed');
  }

  // Normalize the seller against the API rather than trusting the callback.
  let sellerId = tokens.user_id;
  let nickname: string | null = null;
  let siteId = attempt.site_id;
  try {
    const response = await fetch(`${MELI_API_BASE}/users/${tokens.user_id}`, {
      headers: { Authorization: `Bearer ${tokens.access_token}`, Accept: 'application/json' },
      cache: 'no-store',
    });
    if (response.ok) {
      const user = meliUserSchema.parse(await response.json());
      sellerId = user.id;
      nickname = user.nickname ?? null;
      siteId = user.site_id ?? attempt.site_id;
    }
  } catch (error) {
    logger.warn('oauth_user_normalization_failed', { correlation_id: correlationId, error });
  }

  const { data: linkData, error: linkError } = await supabase.rpc('backend_link_meli_account' as never, {
    p_org_id: attempt.org_id,
    p_user_id: attempt.user_id,
    p_seller_id: sellerId,
    p_nickname: nickname,
    p_site_id: siteId,
    p_access_token: tokens.access_token,
    p_refresh_token: tokens.refresh_token,
    // Rule 12: the TTL is whatever expires_in says, never a hardcoded 3h/6h.
    p_expires_at: new Date(Date.now() + tokens.expires_in * 1000).toISOString(),
    p_scope: tokens.scope.split(' ').filter(Boolean),
  } as never);

  if (linkError) {
    const alreadyLinked = linkError.message?.includes('seller_already_linked');
    logger.warn('oauth_link_failed', { correlation_id: correlationId, event: linkError.code ?? 'unknown' });
    return failure(request, alreadyLinked ? 'seller_already_linked' : 'link_failed');
  }

  const accountId = String(linkData ?? '');
  await supabase.rpc('backend_provision_rate_buckets' as never, { p_account_id: accountId } as never);
  await supabase.rpc('backend_enqueue_bootstrap' as never, { p_account_id: accountId } as never);

  logger.info('oauth_linked', {
    correlation_id: correlationId,
    org_id: attempt.org_id,
    meli_account_id: accountId,
    event: 'oauth_linked',
  });

  const env = serverEnv();
  void env;
  return NextResponse.redirect(new URL(`/?meli_linked=${accountId}`, request.url));
}
