import { AccountRestrictedError, ReconnectRequiredError, RetryableError, parseRetryAfter } from './errors.ts';
import { acquireBudget, penalize, type ResourceClass } from './rate-budget.ts';
import { getValidAccessToken } from './token-broker.ts';

const API_BASE = 'https://api.mercadolibre.com';

export interface RequestOptions {
  method?: 'GET' | 'POST' | 'PUT';
  query?: Record<string, string | number | boolean | undefined>;
  body?: unknown;
  headers?: Record<string, string>;
  resourceClass?: ResourceClass;
  endpointClass: string;
  idempotencyKey?: string;
  timeoutMs?: number;
}

export class MeliClient {
  constructor(private readonly accountId: string) {}

  async request<T>(path: string, options: RequestOptions): Promise<T> {
    const resourceClass = options.resourceClass ?? 'default';
    await acquireBudget(this.accountId, resourceClass);
    const token = await getValidAccessToken(this.accountId);

    const url = new URL(path.startsWith('http') ? path : `${API_BASE}${path}`);
    for (const [key, value] of Object.entries(options.query ?? {})) {
      if (value !== undefined) url.searchParams.set(key, String(value));
    }

    const headers: Record<string, string> = {
      Authorization: `Bearer ${token}`,
      Accept: 'application/json',
      ...options.headers,
    };
    if (options.body !== undefined) headers['Content-Type'] = 'application/json';
    if (options.idempotencyKey) headers['X-Idempotency-Key'] = options.idempotencyKey;

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), options.timeoutMs ?? 15_000);

    let response: Response;
    try {
      response = await fetch(url, {
        method: options.method ?? 'GET',
        headers,
        body: options.body === undefined ? undefined : JSON.stringify(options.body),
        signal: controller.signal,
      });
    } catch {
      throw new RetryableError('meli_network_error');
    } finally {
      clearTimeout(timer);
    }

    if (response.status === 429) {
      const retryAfterMs = parseRetryAfter(response.headers.get('Retry-After'));
      await penalize(this.accountId, resourceClass, retryAfterMs);
      throw new RetryableError('meli_rate_limited', retryAfterMs);
    }
    if (response.status === 401) throw new ReconnectRequiredError('unauthorized');
    if (response.status === 403) throw new AccountRestrictedError(options.endpointClass);
    if (response.status === 404) throw new Error(`meli_not_found:${options.endpointClass}`);
    if (response.status >= 500) throw new RetryableError(`meli_server_error:${response.status}`);
    if (!response.ok) throw new Error(`meli_request_failed:${response.status}:${options.endpointClass}`);
    if (response.status === 204) return undefined as T;

    return (await response.json()) as T;
  }
}
