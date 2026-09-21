import 'server-only';
import { createAdminClient } from '@/lib/supabase/admin';
import { RetryableError } from './errors';

/**
 * Token buckets (section 3.1). Most MercadoLibre limits are not published, so
 * budgets are conservative, configurable and adjusted by 429 telemetry rather
 * than by an invented global number.
 */
export type ResourceClass = 'default' | 'messaging' | 'oauth' | 'stock';

export function resourceClassForTopic(topic: string): ResourceClass {
  if (topic.startsWith('messages')) return 'messaging';
  if (topic.startsWith('stock') || topic.startsWith('user-products')) return 'stock';
  return 'default';
}

export function bucketKeys(resourceClass: ResourceClass, accountId: string): string[] {
  return [`global:${resourceClass}`, `account:${accountId}:${resourceClass}`];
}

interface TakeResult {
  granted: boolean;
  wait_ms: number;
  tokens_remaining: number;
}

async function takeToken(bucketKey: string, cost = 1): Promise<TakeResult> {
  const supabase = createAdminClient();
  const { data, error } = await supabase.rpc('backend_take_rate_token' as never, {
    p_bucket_key: bucketKey,
    p_cost: cost,
  } as never);
  if (error) {
    // An unknown bucket means the account has not been provisioned yet.
    throw new RetryableError(`rate_bucket_error:${error.code ?? 'unknown'}`);
  }
  const rows = data as unknown as TakeResult[] | TakeResult | null;
  const row = Array.isArray(rows) ? rows[0] : rows;
  return row ?? { granted: false, wait_ms: 1000, tokens_remaining: 0 };
}

/**
 * Acquires one token from every bucket that governs the call. Throws a
 * RetryableError carrying the wait so the worker can requeue with visibility
 * timeout instead of busy-waiting.
 */
export async function acquireBudget(
  accountId: string,
  resourceClass: ResourceClass,
  cost = 1,
): Promise<void> {
  for (const key of bucketKeys(resourceClass, accountId)) {
    const result = await takeToken(key, cost);
    if (!result.granted) {
      throw new RetryableError(`rate_limited:${key}`, result.wait_ms);
    }
  }
}

/** Applies observed 429 pressure by shrinking the learned multiplier. */
export async function penalizeBucket(
  accountId: string,
  resourceClass: ResourceClass,
  retryAfterMs: number | null,
): Promise<void> {
  const supabase = createAdminClient();
  await supabase.rpc('backend_penalize_rate_bucket' as never, {
    p_bucket_key: `account:${accountId}:${resourceClass}`,
    p_blocked_ms: retryAfterMs ?? 30_000,
  } as never);
}
