import { NextResponse, type NextRequest } from 'next/server';
import { z } from 'zod';
import { checkPermission } from '@/lib/auth/require-role';
import { pkceEnabled, serverEnv } from '@/lib/env/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { authorizationUrl, isSiteId } from '@/lib/meli/site-config';
import { challengeFromVerifier, createState, createVerifier, sha256Hex } from '@/lib/meli/pkce';
import { logger } from '@/lib/observability/logger';
import { newCorrelationId } from '@/lib/observability/correlation';

export const dynamic = 'force-dynamic';

const bodySchema = z.object({
  orgSlug: z.string().min(2),
  siteId: z.string().refine(isSiteId, 'unsupported_site'),
});

/**
 * Step 1-5 of the linking flow (section 5.2). The state hash, not the state, is
 * persisted; the PKCE verifier lives in the private schema and never reaches
 * the browser.
 */
export async function POST(request: NextRequest) {
  const correlationId = newCorrelationId();
  const parsed = bodySchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: 'invalid_request' }, { status: 400 });
  }

  const permission = await checkPermission(parsed.data.orgSlug, 'accounts:connect');
  if (!permission.ok) {
    return NextResponse.json({ error: 'forbidden' }, { status: permission.status });
  }

  const env = serverEnv();
  const state = createState();
  const stateHash = await sha256Hex(state);

  let codeChallenge: string | null = null;
  let verifier: string | null = null;
  if (pkceEnabled()) {
    verifier = createVerifier();
    codeChallenge = await challengeFromVerifier(verifier);
  }

  const supabase = createAdminClient();
  const { error } = await supabase.rpc('backend_create_oauth_link_attempt' as never, {
    p_org_id: permission.ctx.orgId,
    p_user_id: permission.ctx.userId,
    p_site_id: parsed.data.siteId,
    p_state_hash: stateHash,
    p_redirect_uri: env.MELI_REDIRECT_URI,
    p_code_verifier: verifier,
    p_ttl_seconds: 600,
  } as never);

  if (error) {
    logger.error('oauth_link_attempt_failed', { correlation_id: correlationId, error });
    return NextResponse.json({ error: 'link_attempt_failed' }, { status: 500 });
  }

  const params: Record<string, string> = {
    response_type: 'code',
    client_id: env.MELI_APP_ID,
    redirect_uri: env.MELI_REDIRECT_URI,
    state,
  };
  if (codeChallenge) {
    params.code_challenge = codeChallenge;
    params.code_challenge_method = 'S256';
  }

  logger.info('oauth_authorization_started', {
    correlation_id: correlationId,
    org_id: permission.ctx.orgId,
    event: 'oauth_authorization_started',
  });

  return NextResponse.json({ url: authorizationUrl(parsed.data.siteId, params) });
}
