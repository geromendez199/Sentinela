import { AccountRestrictedError, ReconnectRequiredError, RetryableError, parseRetryAfter } from './errors.ts';
import { acquireBudget, penalize, type ResourceClass } from './rate-budget.ts';
import { getValidAccessToken } from './token-broker.ts';
import { CircuitBreaker, CircuitOpenError, fullJitterDelay } from './circuit-breaker.ts';

const API_BASE = 'https://api.mercadolibre.com';
const circuitBreaker = new CircuitBreaker();

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

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

  async get<T>(path: string, options: Omit<RequestOptions, 'method'>): Promise<T> {
    return this.request<T>(path, { ...options, method: 'GET' });
  }

  async request<T>(path: string, options: RequestOptions): Promise<T> {
    const resourceClass = options.resourceClass ?? 'default';
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

    const method = options.method ?? 'GET';
    const maxAttempts = method === 'GET' || options.idempotencyKey ? 3 : 1;
    const circuitKey = this.accountId;

    for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
      try {
        circuitBreaker.beforeRequest(circuitKey);
      } catch (error) {
        if (error instanceof CircuitOpenError) {
          throw new RetryableError(error.message, error.retryAfterMs);
        }
        throw error;
      }

      await acquireBudget(this.accountId, resourceClass);
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), options.timeoutMs ?? 15_000);
      let response: Response;
      try {
        response = await fetch(url, {
          method,
          headers,
          body: options.body === undefined ? undefined : JSON.stringify(options.body),
          signal: controller.signal,
        });
      } catch {
        circuitBreaker.recordFailure(circuitKey);
        if (attempt < maxAttempts) {
          await sleep(fullJitterDelay(attempt));
          continue;
        }
        throw new RetryableError('meli_network_error');
      } finally {
        clearTimeout(timer);
      }

      if (response.status === 429 || response.status >= 500) {
        const retryAfterMs = response.status === 429
          ? parseRetryAfter(response.headers.get('Retry-After'))
          : null;
        if (response.status === 429) await penalize(this.accountId, resourceClass, retryAfterMs);
        circuitBreaker.recordFailure(circuitKey);
        if (attempt < maxAttempts) {
          await sleep(Math.max(retryAfterMs ?? 0, fullJitterDelay(attempt)));
          continue;
        }
        throw new RetryableError(
          response.status === 429 ? 'meli_rate_limited' : `meli_server_error:${response.status}`,
          retryAfterMs,
        );
      }
      if (response.status === 401) throw new ReconnectRequiredError('unauthorized');
      if (response.status === 403) throw new AccountRestrictedError(options.endpointClass);
      if (response.status === 404) throw new Error(`meli_not_found:${options.endpointClass}`);
      if (!response.ok) throw new Error(`meli_request_failed:${response.status}:${options.endpointClass}`);

      circuitBreaker.recordSuccess(circuitKey);
      if (response.status === 204) return undefined as T;
      return (await response.json()) as T;
    }

    throw new RetryableError('meli_retry_exhausted');
  }
}
