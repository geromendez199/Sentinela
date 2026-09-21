/** Error taxonomy for the MercadoLibre boundary (sections 3.4 and 9). */

export class MeliError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly meliCode: string | null,
    readonly endpointClass: string,
  ) {
    super(message);
    this.name = 'MeliError';
  }
}

/** 429 or a transient 5xx: safe to retry with backoff and full jitter. */
export class RetryableError extends Error {
  constructor(
    message: string,
    readonly retryAfterMs: number | null = null,
  ) {
    super(message);
    this.name = 'RetryableError';
  }
}

/** invalid_grant or a revoked grant: the account needs a fresh authorization. */
export class ReconnectRequiredError extends Error {
  constructor(readonly reason = 'invalid_grant') {
    super(`reconnect_required:${reason}`);
    this.name = 'ReconnectRequiredError';
  }
}

/** 403 / suspension: reads may still work, writes must be blocked. */
export class AccountRestrictedError extends Error {
  constructor(readonly detail: string) {
    super(`account_restricted:${detail}`);
    this.name = 'AccountRestrictedError';
  }
}

/** The action guide, capability or resource state changed after approval. */
export class PolicyChangedError extends Error {
  constructor(readonly detail: string) {
    super(`policy_changed:${detail}`);
    this.name = 'PolicyChangedError';
  }
}

export function isRetryable(error: unknown): boolean {
  if (error instanceof RetryableError) return true;
  if (error instanceof MeliError) return error.status === 429 || error.status >= 500;
  return false;
}

export function isInvalidGrant(error: unknown): boolean {
  if (error instanceof ReconnectRequiredError) return true;
  if (error instanceof MeliError) {
    return error.meliCode === 'invalid_grant' || error.meliCode === 'forbidden_grant';
  }
  return false;
}

/** Strips anything that could carry token material out of a provider error. */
export function sanitizeOAuthError(error: unknown): string {
  if (error instanceof MeliError) return `${error.status}:${error.meliCode ?? 'unknown'}`;
  if (error instanceof Error) return error.name;
  return 'unknown_error';
}

/** Exponential backoff with full jitter. Never a retry storm (rule 10). */
export function backoffMs(attempt: number, baseMs = 500, capMs = 60_000): number {
  const exp = Math.min(capMs, baseMs * 2 ** Math.max(0, attempt - 1));
  return Math.floor(Math.random() * exp);
}

export function parseRetryAfter(header: string | null): number | null {
  if (!header) return null;
  const seconds = Number(header);
  if (Number.isFinite(seconds)) return Math.max(0, seconds * 1000);
  const date = Date.parse(header);
  if (Number.isFinite(date)) return Math.max(0, date - Date.now());
  return null;
}
