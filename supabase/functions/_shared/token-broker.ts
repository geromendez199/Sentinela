import { adminClient, rpc } from './db.ts';
import { loadMeliOAuthEnv } from './env.ts';
import { ReconnectRequiredError, RetryableError, isInvalidGrant } from './errors.ts';
import { log } from './logging.ts';

/**
 * The only component allowed to call POST /oauth/token with a refresh token.
 * MercadoLibre rotates refresh tokens, so a concurrent refresh is not a retry:
 * it can invalidate the account. Lease + credential_version CAS prevents that.
 */
interface Material {
  access_token: string;
  refresh_token: string;
  expires_at: string;
  credential_version: number;
  account_status: string;
}

const TOKEN_URL = 'https://api.mercadolibre.com/oauth/token';

function firstRow<T>(data: unknown): T | null {
  if (Array.isArray(data)) return (data[0] ?? null) as T | null;
  return (data ?? null) as T | null;
}

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

export async function getValidAccessToken(accountId: string): Promise<string> {
  const material = firstRow<Material>(
    await rpc<unknown>('backend_get_oauth_material', { p_account_id: accountId }),
  );
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
    const newer = firstRow<Material>(
      await rpc<unknown>('backend_get_oauth_material', { p_account_id: accountId }),
    );
    if (newer && newer.credential_version > material.credential_version) return newer.access_token;
    throw new RetryableError('refresh_in_progress');
  }

  const env = loadMeliOAuthEnv();
  try {
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
        await adminClient()
          .from('meli_accounts')
          .update({ status: 'reconnect_required', status_reason: code })
          .eq('id', accountId);
        throw new ReconnectRequiredError(code);
      }
      throw new RetryableError(`refresh_failed:${code}`);
    }

    if (!payload.access_token || !payload.refresh_token || !payload.expires_in) {
      throw new RetryableError('refresh_response_incomplete');
    }

    let committed = false;
    for (let attempt = 1; attempt <= 5 && !committed; attempt++) {
      try {
        await rpc('backend_commit_refresh', {
          p_account_id: accountId,
          p_owner: owner,
          p_expected_version: material.credential_version,
          p_access_token: payload.access_token,
          p_refresh_token: payload.refresh_token,
          p_expires_at: new Date(Date.now() + payload.expires_in * 1000).toISOString(),
          p_scope: (payload.scope ?? '').split(' ').filter(Boolean),
        });
        committed = true;
      } catch (error) {
        if (attempt === 5) throw error;
        await sleep(100 * attempt);
      }
    }

    log('info', 'token_refreshed', { meli_account_id: accountId });
    return payload.access_token;
  } catch (error) {
    if (isInvalidGrant(error)) {
      await adminClient()
        .from('meli_accounts')
        .update({ status: 'reconnect_required', status_reason: 'invalid_grant' })
        .eq('id', accountId);
      throw new ReconnectRequiredError();
    }
    throw error;
  } finally {
    await rpc('backend_release_refresh_lease', { p_account_id: accountId, p_owner: owner }).catch(
      () => undefined,
    );
  }
}
