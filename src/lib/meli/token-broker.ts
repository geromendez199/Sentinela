import 'server-only';
import { createAdminClient } from '@/lib/supabase/admin';
import { logger } from '@/lib/observability/logger';
import { refreshAccessToken } from './auth';
import {
  ReconnectRequiredError,
  RetryableError,
  isInvalidGrant,
  sanitizeOAuthError,
} from './errors';
import type { OAuthMaterial } from './types/oauth';

/**
 * Token broker (section 5.3).
 *
 * A PostgREST/RPC transaction ends before the outbound HTTP call, so a row lock
 * cannot protect the refresh. Instead: a persistent lease plus a credential
 * version CAS, and exactly one service allowed to call /oauth/token.
 */

const LEASE_SECONDS = 30;
const BASE_SKEW_MS = 90_000;
const JITTER_MS = 30_000;

function rowOf<T>(data: T[] | T | null): T | null {
  if (data === null) return null;
  return Array.isArray(data) ? (data[0] ?? null) : data;
}

async function getMaterial(accountId: string): Promise<OAuthMaterial> {
  const supabase = createAdminClient();
  const { data, error } = await supabase.rpc('backend_get_oauth_material' as never, {
    p_account_id: accountId,
  } as never);
  if (error) throw new RetryableError(`oauth_material_unavailable:${error.code ?? 'unknown'}`);

  const row = rowOf(data as unknown as Record<string, unknown>[] | null);
  if (!row) throw new ReconnectRequiredError('credentials_missing');

  return {
    accessToken: String(row.access_token ?? ''),
    refreshToken: String(row.refresh_token ?? ''),
    expiresAt: new Date(String(row.expires_at)),
    credentialVersion: Number(row.credential_version ?? 0),
    status: String(row.account_status ?? 'unknown'),
  };
}

async function markReconnectRequired(accountId: string, reason: string): Promise<void> {
  const supabase = createAdminClient();
  await supabase
    .from('meli_accounts')
    .update({ status: 'reconnect_required', status_reason: reason } as never)
    .eq('id', accountId);
  logger.warn('account_reconnect_required', { meli_account_id: accountId, event: reason });
}

async function releaseLeaseIfOwned(accountId: string, owner: string): Promise<void> {
  try {
    const supabase = createAdminClient();
    await supabase.rpc('backend_release_refresh_lease' as never, {
      p_account_id: accountId,
      p_owner: owner,
    } as never);
  } catch (error) {
    logger.warn('lease_release_failed', { meli_account_id: accountId, error });
  }
}

async function retryCommit<T>(fn: () => Promise<T>, attempts = 5): Promise<T> {
  let lastError: unknown;
  for (let attempt = 1; attempt <= attempts; attempt++) {
    try {
      return await fn();
    } catch (error) {
      // A rotated refresh token that is not persisted is a lost account.
      lastError = error;
      await sleep(100 * attempt);
    }
  }
  throw lastError;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function randomBetween(min: number, max: number): number {
  return min + Math.random() * (max - min);
}

/**
 * Returns a usable access token, refreshing it at most once per account across
 * every concurrent caller.
 */
export async function getValidAccessToken(accountId: string): Promise<string> {
  const material = await getMaterial(accountId);

  if (material.status === 'reconnect_required' || material.status === 'disconnected') {
    throw new ReconnectRequiredError(material.status);
  }

  const skewMs = BASE_SKEW_MS + randomBetween(0, JITTER_MS);
  if (material.expiresAt.getTime() - Date.now() > skewMs) return material.accessToken;

  const supabase = createAdminClient();
  const owner = crypto.randomUUID();

  const { data: leaseData, error: leaseError } = await supabase.rpc(
    'backend_acquire_refresh_lease' as never,
    {
      p_account_id: accountId,
      p_owner: owner,
      p_expected_version: material.credentialVersion,
      p_lease_seconds: LEASE_SECONDS,
    } as never,
  );
  if (leaseError) throw new RetryableError('lease_rpc_failed');

  const acquired = (leaseData as unknown as boolean | null) === true;

  if (!acquired) {
    // Another worker is refreshing. Give it a moment, then read the new version.
    await sleep(randomBetween(100, 400));
    const newer = await getMaterial(accountId);
    if (newer.credentialVersion > material.credentialVersion) return newer.accessToken;
    throw new RetryableError('refresh_in_progress');
  }

  try {
    const refreshed = await refreshAccessToken(material.refreshToken);

    await retryCommit(async () => {
      const { error } = await supabase.rpc('backend_commit_refresh' as never, {
        p_account_id: accountId,
        p_owner: owner,
        p_expected_version: material.credentialVersion,
        p_access_token: refreshed.access_token,
        p_refresh_token: refreshed.refresh_token,
        p_expires_at: new Date(Date.now() + refreshed.expires_in * 1000).toISOString(),
        p_scope: refreshed.scope.split(' ').filter(Boolean),
      } as never);
      if (error) throw new Error(`commit_refresh_failed:${error.code ?? 'unknown'}`);
    });

    logger.info('token_refreshed', {
      meli_account_id: accountId,
      event: 'token_refreshed',
      expires_in_s: refreshed.expires_in,
    });

    return refreshed.access_token;
  } catch (error) {
    if (isInvalidGrant(error)) {
      await markReconnectRequired(accountId, sanitizeOAuthError(error));
      throw new ReconnectRequiredError();
    }
    throw error;
  } finally {
    await releaseLeaseIfOwned(accountId, owner);
  }
}
