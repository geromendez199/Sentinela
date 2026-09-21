import 'server-only';
import { logger } from '@/lib/observability/logger';
import { recordMetric } from '@/lib/observability/metrics';
import {
  AccountRestrictedError,
  MeliError,
  ReconnectRequiredError,
  RetryableError,
  parseRetryAfter,
} from './errors';
import { acquireBudget, penalizeBucket, type ResourceClass } from './rate-budget';
import { getValidAccessToken } from './token-broker';
import { MELI_API_BASE } from './site-config';

export interface MeliRequestOptions {
  method?: 'GET' | 'POST' | 'PUT' | 'DELETE';
  query?: Record<string, string | number | boolean | undefined>;
  body?: unknown;
  headers?: Record<string, string>;
  resourceClass?: ResourceClass;
  /** Classifies the call for audit and telemetry without logging the full URL. */
  endpointClass: string;
  correlationId?: string;
  /** Idempotency key for approved writes (section 8.4). */
  idempotencyKey?: string;
  timeoutMs?: number;
}

function buildUrl(path: string, query?: MeliRequestOptions['query']): string {
  const url = new URL(path.startsWith('http') ? path : `${MELI_API_BASE}${path}`);
  if (query) {
    for (const [key, value] of Object.entries(query)) {
      if (value !== undefined) url.searchParams.set(key, String(value));
    }
  }
  return url.toString();
}

/**
 * Authenticated MercadoLibre client for one linked account.
 *
 * Responsibilities: token acquisition through the broker, rate budget, error
 * taxonomy and telemetry. It never interprets payloads: adapters do that.
 */
export class MeliClient {
  constructor(private readonly accountId: string) {}

  async request<T>(path: string, options: MeliRequestOptions): Promise<T> {
    const resourceClass = options.resourceClass ?? 'default';
    await acquireBudget(this.accountId, resourceClass);

    const token = await getValidAccessToken(this.accountId);
    const url = buildUrl(path, options.query);

    const headers: Record<string, string> = {
      Authorization: `Bearer ${token}`,
      Accept: 'application/json',
      ...options.headers,
    };
    if (options.body !== undefined) headers['Content-Type'] = 'application/json';
    if (options.idempotencyKey) headers['X-Idempotency-Key'] = options.idempotencyKey;

    const startedAt = Date.now();
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), options.timeoutMs ?? 15_000);

    let response: Response;
    try {
      response = await fetch(url, {
        method: options.method ?? 'GET',
        headers,
        body: options.body === undefined ? undefined : JSON.stringify(options.body),
        signal: controller.signal,
        cache: 'no-store',
      });
    } catch (error) {
      clearTimeout(timeout);
      throw new RetryableError(
        error instanceof Error && error.name === 'AbortError' ? 'meli_timeout' : 'meli_network_error',
      );
    }
    clearTimeout(timeout);

    const durationMs = Date.now() - startedAt;
    void recordMetric({
      name: 'meli_request_ms',
      value: durationMs,
      meli_account_id: this.accountId,
      labels: { endpoint_class: options.endpointClass, status: response.status },
    });

    if (response.status === 429) {
      const retryAfterMs = parseRetryAfter(response.headers.get('Retry-After'));
      await penalizeBucket(this.accountId, resourceClass, retryAfterMs);
      logger.warn('meli_rate_limited', {
        meli_account_id: this.accountId,
        event: options.endpointClass,
        correlation_id: options.correlationId,
      });
      throw new RetryableError('meli_rate_limited', retryAfterMs);
    }

    if (response.status === 401) {
      // The broker owns recovery: a 401 after a fresh token means the grant died.
      throw new ReconnectRequiredError('unauthorized');
    }

    if (response.status === 403) {
      throw new AccountRestrictedError(options.endpointClass);
    }

    if (!response.ok) {
      const payload = (await response.json().catch(() => null)) as { error?: string } | null;
      const error = new MeliError(
        'meli_request_failed',
        response.status,
        payload?.error ?? null,
        options.endpointClass,
      );
      if (response.status >= 500) throw new RetryableError(error.message);
      throw error;
    }

    if (response.status === 204) return undefined as T;
    return (await response.json()) as T;
  }

  get<T>(path: string, options: Omit<MeliRequestOptions, 'method' | 'body'>): Promise<T> {
    return this.request<T>(path, { ...options, method: 'GET' });
  }

  post<T>(path: string, body: unknown, options: Omit<MeliRequestOptions, 'method'>): Promise<T> {
    return this.request<T>(path, { ...options, method: 'POST', body });
  }

  put<T>(path: string, body: unknown, options: Omit<MeliRequestOptions, 'method'>): Promise<T> {
    return this.request<T>(path, { ...options, method: 'PUT', body });
  }
}
