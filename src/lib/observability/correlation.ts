/** Correlation IDs tie a browser action, a queue message and an audit row together. */
export function newCorrelationId(): string {
  return crypto.randomUUID();
}

export const CORRELATION_HEADER = 'x-sentinela-correlation-id';

export function correlationFromHeaders(headers: Headers): string {
  return headers.get(CORRELATION_HEADER) ?? newCorrelationId();
}
