import { rpc } from './db.ts';
import { RetryableError } from './errors.ts';

export type ResourceClass = 'default' | 'messaging' | 'oauth' | 'stock';

interface TakeResult {
  granted: boolean;
  wait_ms: number;
  tokens_remaining: number;
}

export function resourceClassForTopic(topic: string): ResourceClass {
  if (topic.startsWith('messages')) return 'messaging';
  if (topic.startsWith('stock') || topic.startsWith('user-products')) return 'stock';
  return 'default';
}

export async function acquireBudget(
  accountId: string,
  resourceClass: ResourceClass,
  cost = 1,
): Promise<void> {
  for (const key of [`global:${resourceClass}`, `account:${accountId}:${resourceClass}`]) {
    const rows = await rpc<TakeResult[] | TakeResult>('backend_take_rate_token', {
      p_bucket_key: key,
      p_cost: cost,
    });
    const result = Array.isArray(rows) ? rows[0] : rows;
    if (!result?.granted) throw new RetryableError(`rate_limited:${key}`, result?.wait_ms ?? 1000);
  }
}

export async function penalize(
  accountId: string,
  resourceClass: ResourceClass,
  retryAfterMs: number | null,
): Promise<void> {
  await rpc('backend_penalize_rate_bucket', {
    p_bucket_key: `account:${accountId}:${resourceClass}`,
    p_blocked_ms: retryAfterMs ?? 30_000,
  });
}
