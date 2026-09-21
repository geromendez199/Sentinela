export class RetryableError extends Error {
  constructor(message: string, readonly retryAfterMs: number | null = null) {
    super(message);
    this.name = 'RetryableError';
  }
}

export class ReconnectRequiredError extends Error {
  constructor(readonly reason = 'invalid_grant') {
    super(`reconnect_required:${reason}`);
    this.name = 'ReconnectRequiredError';
  }
}

export class AccountRestrictedError extends Error {
  constructor(readonly detail: string) {
    super(`account_restricted:${detail}`);
    this.name = 'AccountRestrictedError';
  }
}

export function backoffMs(attempt: number, baseMs = 500, capMs = 60_000): number {
  const exp = Math.min(capMs, baseMs * 2 ** Math.max(0, attempt - 1));
  return Math.floor(Math.random() * exp);
}

export function parseRetryAfter(header: string | null): number | null {
  if (!header) return null;
  const seconds = Number(header);
  if (Number.isFinite(seconds)) return Math.max(0, seconds * 1000);
  const at = Date.parse(header);
  return Number.isFinite(at) ? Math.max(0, at - Date.now()) : null;
}

export function isInvalidGrant(error: unknown): boolean {
  return error instanceof Error && /invalid_grant|forbidden_grant/.test(error.message);
}
