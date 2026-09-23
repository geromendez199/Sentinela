import { adminClient, rpc } from './db.ts';
import { loadMeliOAuthEnv } from './env.ts';
import { ReconnectRequiredError, RetryableError, isInvalidGrant } from './errors.ts';
import { log } from './logging.ts';

/**
 * The only component allowed to call POST /oauth/token with a refresh token.
 * MercadoLibre rotates refresh tokens, so a concurrent refresh is not a retry:
 * it can invalidate the account. Lease + credential_version CAS prevents that.
 *
 * A successful rotating refresh is staged in Vault before the canonical
 * credential pair is replaced. If the canonical commit is interrupted, the next
 * broker holding the lease finalizes the staged pair instead of reusing the now
 * invalid old refresh token.
 */
interface Material {
  access_token: string;
  refresh_token: string;
  expires_at: string;
  credential_version: number;
  account_status: string;
}

interface StagedCommit {
  access_token: string;
  credential_version: number;
}

const TOKEN_URL = 'https://api.mercadolibre.com/oauth/token';
const PERSIST_RETRIES = 5;

function firstRow<T>(data: unknown): T | null {
  if (Array.isArray(data)) return (data[0] ?? null) as T | null;
  return (data ?? null) as T | null;
}

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

async function commitStagedRefresh(
  accountId: string,
  owner: string,
  expectedVersion: number,
): Promise<StagedCommit | null> {
  return firstRow<StagedCommit>(
    await rpc<unknown>('backend_commit_staged_refresh', {
      p_account_id: accountId,
      p_owner: owner,
      p_expected_version: expectedVersion,
    }),
  );
}

async function markReconnectRequired(accountId: string, reason: string): Promise<void> {
  const client = adminClient();
  const { data: account } = await client
    .from('meli_accounts')
    .select('org_id')
    .eq('id', accountId)
    .maybeSingle();

  await client
    .from('meli_accounts')
    .update({ status: 'reconnect_required', status_reason: reason })
    .eq('id', accountId);

  if (account?.org_id) {
    await client.from('security_audit_log').insert({
      org_id: account.org_id,
      meli_account_id: accountId,
      action: 'oauth_reconnect_required',
      resource_type: 'meli_account',
      resource_id: accountId,
      metadata: { reason },
    });
  }
}

async function newerMaterial(accountId: string): Promise<Material | null> {
  return firstRow<Material>(
    await rpc<unknown>('backend_get_oauth_material', { p_account_id: accountId }),
  );
}

export async function getValidAccessToken(accountId: string): Promise<string> {
  const material = await newerMaterial(accountId);
  if (!material) throw new ReconnectRequiredError('credentials_missing');
  if (material.account_status === 'reconnect_required' || material.account_status === 'disconnected') {
    throw new ReconnectRequiredError(material.account_status);
  }

  const skewMs = 90_000 + Math.random() * 30_000;
  if (Date.parse(material.expires_at) - Date.now() > skewMs) return material.access_token;

  const owner = crypto.randomUUID();
  const acquired = await rpc<boolean>('backend_acquire_refresh_lease', {
    p_account_id: accountId,
    p_owner: owner,
    p_expected_version: material.credential_version,
    p_lease_seconds: 30,
  });

  if (!acquired) {
    await sleep(100 + Math.random() * 300);
    const newer = await newerMaterial(accountId);
    if (newer && newer.credential_version > material.credential_version) return newer.access_token;
    throw new RetryableError('refresh_in_progress');
  }

  try {
    // A previous broker may have received a rotated token and then lost the
    // canonical commit response. Never call MELI with the old refresh token until
    // we know there is no staged recovery for this credential version.
    try {
      const recovered = await commitStagedRefresh(accountId, owner, material.credential_version);
      if (recovered) {
        log('info', 'token_refresh_recovered', {
          meli_account_id: accountId,
          credential_version: recovered.credential_version,
        });
        return recovered.access_token;
      }
    } catch {
      throw new RetryableError('refresh_recovery_probe_failed');
    }

    const env = loadMeliOAuthEnv();
    const response = await fetch(TOKEN_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded', Accept: 'application/json' },
      body: new URLSearchParams({
        grant_type: 'refresh_token',
        client_id: env.meliAppId,
        client_secret: env.meliClientSecret,
        refresh_token: material.refresh_token,
      }),
    });

    const payload = (await response.json().catch(() => ({}))) as {
      access_token?: string;
      refresh_token?: string;
      expires_in?: number;
      scope?: string;
      error?: string;
    };

    if (!response.ok) {
      const code = payload.error ?? `http_${response.status}`;
      if (code === 'invalid_grant' || response.status === 400) {
        await markReconnectRequired(accountId, code).catch(() => {
          log('error', 'oauth_reconnect_state_persist_failed', {
            meli_account_id: accountId,
            reason: 'invalid_grant',
          });
        });
        throw new ReconnectRequiredError(code);
      }
      throw new RetryableError(`refresh_failed:${code}`);
    }

    if (
      !payload.access_token ||
      !payload.refresh_token ||
      !Number.isFinite(payload.expires_in) ||
      (payload.expires_in ?? 0) <= 0
    ) {
      throw new RetryableError('refresh_response_incomplete');
    }

    const expiresAt = new Date(Date.now() + payload.expires_in * 1000).toISOString();
    const scope = (payload.scope ?? '').split(' ').filter(Boolean);

    // First durable write after MELI rotates the single-use refresh token: Vault.
    // Retrying this RPC is safe and idempotently overwrites the same recovery slots.
    let staged = false;
    for (let attempt = 1; attempt <= PERSIST_RETRIES; attempt++) {
      try {
        await rpc<boolean>('backend_stage_refresh_recovery', {
          p_account_id: accountId,
          p_owner: owner,
          p_expected_version: material.credential_version,
          p_access_token: payload.access_token,
          p_refresh_token: payload.refresh_token,
          p_expires_at: expiresAt,
          p_scope: scope,
        });
        staged = true;
        break;
      } catch {
        if (attempt < PERSIST_RETRIES) await sleep(100 * attempt);
      }
    }

    if (!staged) {
      // The stage RPC response itself may have been lost after commit. Probe by
      // attempting the staged commit before declaring the rotated pair lost.
      try {
        const recovered = await commitStagedRefresh(accountId, owner, material.credential_version);
        if (recovered) {
          log('info', 'token_refresh_recovered_after_stage_timeout', {
            meli_account_id: accountId,
            credential_version: recovered.credential_version,
          });
          return recovered.access_token;
        }

        await rpc<boolean>('backend_mark_refresh_persistence_failure', {
          p_account_id: accountId,
          p_owner: owner,
          p_expected_version: material.credential_version,
          p_recoverable: false,
          p_error_code: 'refresh_result_unpersisted',
        });
        throw new ReconnectRequiredError('refresh_result_unpersisted');
      } catch (error) {
        if (error instanceof ReconnectRequiredError) throw error;
        log('error', 'refresh_recovery_state_unknown', { meli_account_id: accountId });
        throw new RetryableError('refresh_recovery_state_unknown');
      }
    }

    // Finalize from Vault into the canonical Vault slots. If the RPC commits but
    // its response is lost, the version re-read below detects the successful CAS.
    for (let attempt = 1; attempt <= PERSIST_RETRIES; attempt++) {
      try {
        const committed = await commitStagedRefresh(accountId, owner, material.credential_version);
        if (committed) {
          log('info', 'token_refreshed', {
            meli_account_id: accountId,
            credential_version: committed.credential_version,
          });
          return committed.access_token;
        }
      } catch {
        // Re-read after all retries; a lost successful response advances the CAS.
      }
      if (attempt < PERSIST_RETRIES) await sleep(100 * attempt);
    }

    try {
      const newer = await newerMaterial(accountId);
      if (newer && newer.credential_version > material.credential_version) {
        log('info', 'token_refresh_commit_confirmed_by_version', {
          meli_account_id: accountId,
          credential_version: newer.credential_version,
        });
        return newer.access_token;
      }
    } catch {
      // Recovery remains staged in Vault; the next broker can finalize it.
    }

    await rpc<boolean>('backend_mark_refresh_persistence_failure', {
      p_account_id: accountId,
      p_owner: owner,
      p_expected_version: material.credential_version,
      p_recoverable: true,
      p_error_code: 'refresh_commit_deferred',
    }).catch(() => {
      log('error', 'refresh_commit_deferred_audit_failed', { meli_account_id: accountId });
    });

    throw new RetryableError('refresh_commit_deferred');
  } catch (error) {
    if (isInvalidGrant(error)) {
      await markReconnectRequired(accountId, 'invalid_grant').catch(() => {
        log('error', 'oauth_reconnect_state_persist_failed', {
          meli_account_id: accountId,
          reason: 'invalid_grant',
        });
      });
      throw new ReconnectRequiredError();
    }
    throw error;
  } finally {
    await rpc('backend_release_refresh_lease', { p_account_id: accountId, p_owner: owner }).catch(
      () => undefined,
    );
  }
}
