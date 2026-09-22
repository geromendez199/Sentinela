import { adminClient } from '../_shared/db.ts';
import { MeliClient } from '../_shared/meli-client.ts';
import { RetryableError } from '../_shared/errors.ts';
import { requireInternalInvocation } from '../_shared/internal-auth.ts';
import { log } from '../_shared/logging.ts';

/**
 * Resumable historical backfill (section 6.5).
 *
 * Date-sliced with checkpoints after every successful page. A window that
 * approaches a pagination ceiling is repeatedly split down to one hour instead
 * of paging past the upstream offset limit. If even an hour exceeds the safe
 * ceiling the job fails explicitly: silently skipping data is forbidden.
 */

const CLAIMS_SAFETY_CEILING = 9_000;
const ORDERS_SAFETY_CEILING = 9_000;
const PAGE_SIZE = 50;
const HOUR_MS = 60 * 60 * 1000;
const DAY_MS = 24 * HOUR_MS;

interface SyncJob {
  id: string;
  org_id: string;
  meli_account_id: string;
  kind: string;
  resource_kind: string | null;
  range_start: string;
  range_end: string;
  cursor: { window_start?: string; window_end?: string; offset?: number; window_ms?: number };
  processed_count: number;
  attempts: number;
}

function initialWindowMs(resourceKind: string | null): number {
  if (resourceKind === 'claims') return 3 * DAY_MS;
  if (resourceKind === 'orders') return 7 * DAY_MS;
  return 7 * DAY_MS;
}

function boundedWindowEnd(start: string, rangeEnd: string, windowMs: number): string {
  return new Date(Math.min(Date.parse(start) + windowMs, Date.parse(rangeEnd))).toISOString();
}

function splitWindow(windowMs: number): number {
  return Math.max(HOUR_MS, Math.floor(windowMs / 2));
}

async function claimJob(): Promise<SyncJob | null> {
  const { data, error } = await adminClient().rpc('backend_claim_sync_job', {
    p_lease_seconds: 300,
  });
  if (error) throw new RetryableError(`claim_job_failed:${error.code ?? 'unknown'}`);
  const rows = data as SyncJob[] | SyncJob | null;
  const job = Array.isArray(rows) ? rows[0] : rows;
  return job ?? null;
}

async function checkpoint(job: SyncJob, cursor: SyncJob['cursor'], processed: number, progress: number) {
  await adminClient()
    .from('sync_jobs')
    .update({
      cursor,
      processed_count: job.processed_count + processed,
      progress: Math.min(1, Math.max(0, progress)),
      updated_at: new Date().toISOString(),
    })
    .eq('id', job.id);
}

function progressFor(job: SyncJob, windowStart: string): number {
  return (
    (Date.parse(windowStart) - Date.parse(job.range_start)) /
    Math.max(1, Date.parse(job.range_end) - Date.parse(job.range_start))
  );
}

async function backfillOrders(client: MeliClient, job: SyncJob): Promise<void> {
  const { data: account } = await adminClient()
    .from('meli_accounts')
    .select('seller_id')
    .eq('id', job.meli_account_id)
    .maybeSingle();
  if (!account) return;

  let windowStart = job.cursor.window_start ?? job.range_start;
  let windowMs = job.cursor.window_ms ?? initialWindowMs('orders');

  if (Date.parse(windowStart) >= Date.parse(job.range_end)) {
    await adminClient()
      .from('sync_jobs')
      .update({ status: 'done', progress: 1, locked_by: null, locked_until: null, updated_at: new Date().toISOString() })
      .eq('id', job.id);
    return;
  }

  while (true) {
    const windowEnd = boundedWindowEnd(windowStart, job.range_end, windowMs);
    const probe = await client.get<{ paging: { total: number }; results: Array<Record<string, unknown>> }>(
      '/orders/search',
      {
        endpointClass: 'orders.search',
        query: {
          seller: account.seller_id,
          'order.date_created.from': windowStart,
          'order.date_created.to': windowEnd,
          offset: 0,
          limit: PAGE_SIZE,
          sort: 'date_asc',
        },
      },
    );

    if (probe.paging.total >= ORDERS_SAFETY_CEILING) {
      if (windowMs <= HOUR_MS) throw new Error('orders_backfill_window_overflow');
      windowMs = splitWindow(windowMs);
      continue;
    }

    let offset = 0;
    let processed = 0;
    while (offset < probe.paging.total) {
      const page =
        offset === 0
          ? probe
          : await client.get<{ paging: { total: number }; results: Array<Record<string, unknown>> }>(
              '/orders/search',
              {
                endpointClass: 'orders.search',
                query: {
                  seller: account.seller_id,
                  'order.date_created.from': windowStart,
                  'order.date_created.to': windowEnd,
                  offset,
                  limit: PAGE_SIZE,
                  sort: 'date_asc',
                },
              },
            );

      for (const order of page.results) {
        const shipping = order.shipping as { id?: number } | undefined;
        const { error } = await adminClient().rpc('backend_upsert_order', {
          p_org_id: job.org_id,
          p_account_id: job.meli_account_id,
          p_order_id: Number(order.id),
          p_pack_id: order.pack_id ?? null,
          p_shipment_id: shipping?.id ?? null,
          p_status: String(order.status ?? 'unknown'),
          p_tags: order.tags ?? [],
          p_date_created: order.date_created ?? null,
          p_date_closed: order.date_closed ?? null,
          p_source_last_updated: order.last_updated ?? order.date_created,
          p_total_amount: order.total_amount ?? null,
          p_currency_id: order.currency_id ?? null,
          p_order_items: order.order_items ?? [],
        });
        if (error) throw new RetryableError(`backfill_order_upsert_failed:${error.code ?? 'unknown'}`);
        processed += 1;
      }

      offset += page.results.length;
      if (page.results.length === 0) break;
      await checkpoint(job, { window_start: windowStart, window_end: windowEnd, offset, window_ms: windowMs }, processed, progressFor(job, windowStart));
    }

    await checkpoint(job, { window_start: windowEnd, offset: 0, window_ms: windowMs }, processed, progressFor(job, windowEnd));
    return;
  }
}

async function backfillClaims(client: MeliClient, job: SyncJob): Promise<void> {
  const { data: account } = await adminClient()
    .from('meli_accounts')
    .select('seller_id')
    .eq('id', job.meli_account_id)
    .maybeSingle();
  if (!account) return;

  let windowStart = job.cursor.window_start ?? job.range_start;
  let windowMs = job.cursor.window_ms ?? initialWindowMs('claims');

  if (Date.parse(windowStart) >= Date.parse(job.range_end)) {
    await adminClient()
      .from('sync_jobs')
      .update({ status: 'done', progress: 1, locked_by: null, locked_until: null, updated_at: new Date().toISOString() })
      .eq('id', job.id);
    return;
  }

  while (true) {
    const windowEnd = boundedWindowEnd(windowStart, job.range_end, windowMs);
    const probe = await client.get<{ paging: { total: number }; data: Array<Record<string, unknown>> }>(
      '/post-purchase/v1/claims/search',
      {
        endpointClass: 'claims.search',
        query: {
          seller_id: account.seller_id,
          date_created_from: windowStart,
          date_created_to: windowEnd,
          offset: 0,
          limit: PAGE_SIZE,
        },
      },
    );

    if (probe.paging.total >= CLAIMS_SAFETY_CEILING) {
      if (windowMs <= HOUR_MS) {
        log('error', 'claims_backfill_window_overflow', {
          meli_account_id: job.meli_account_id,
          window_start: windowStart,
          window_end: windowEnd,
          total: probe.paging.total,
        });
        throw new Error('claims_backfill_window_overflow');
      }
      windowMs = splitWindow(windowMs);
      continue;
    }

    let offset = 0;
    let processed = 0;
    while (offset < probe.paging.total) {
      const page =
        offset === 0
          ? probe
          : await client.get<{ paging: { total: number }; data: Array<Record<string, unknown>> }>(
              '/post-purchase/v1/claims/search',
              {
                endpointClass: 'claims.search',
                query: {
                  seller_id: account.seller_id,
                  date_created_from: windowStart,
                  date_created_to: windowEnd,
                  offset,
                  limit: PAGE_SIZE,
                },
              },
            );

      for (const claim of page.data) {
        const { error } = await adminClient().rpc('backend_upsert_claim', {
          p_org_id: job.org_id,
          p_account_id: job.meli_account_id,
          p_claim_id: Number(claim.id),
          p_claim: claim,
          p_affects_reputation: null,
        });
        if (error) throw new RetryableError(`backfill_claim_upsert_failed:${error.code ?? 'unknown'}`);
        processed += 1;
      }
      offset += page.data.length;
      if (page.data.length === 0) break;
      await checkpoint(job, { window_start: windowStart, window_end: windowEnd, offset, window_ms: windowMs }, processed, progressFor(job, windowStart));
    }

    await checkpoint(job, { window_start: windowEnd, offset: 0, window_ms: windowMs }, processed, progressFor(job, windowEnd));
    return;
  }
}

Deno.serve(async (request) => {
  const authError = await requireInternalInvocation(request);
  if (authError) return authError;

  const body = (await request.json().catch(() => ({}))) as { max_chunks?: number };
  const maxChunks = Math.min(10, Math.max(1, body.max_chunks ?? 4));

  let handled = 0;
  for (let i = 0; i < maxChunks; i++) {
    const job = await claimJob();
    if (!job) break;

    const client = new MeliClient(job.meli_account_id);
    try {
      if (job.resource_kind === 'orders') await backfillOrders(client, job);
      else if (job.resource_kind === 'claims') await backfillClaims(client, job);
      else {
        await adminClient()
          .from('sync_jobs')
          .update({ status: 'done', progress: 1, locked_by: null, locked_until: null, updated_at: new Date().toISOString() })
          .eq('id', job.id);
      }
      handled += 1;
    } catch (error) {
      const retryable = error instanceof RetryableError;
      await adminClient()
        .from('sync_jobs')
        .update({
          status: retryable ? 'queued' : 'failed',
          attempts: job.attempts + 1,
          last_error: String(error).slice(0, 500),
          next_run_at: new Date(Date.now() + (retryable ? 60_000 : 300_000)).toISOString(),
          locked_by: null,
          locked_until: null,
          updated_at: new Date().toISOString(),
        })
        .eq('id', job.id);
      log('error', 'backfill_chunk_failed', { job_id: job.id, error: String(error) });
    }
  }

  return new Response(JSON.stringify({ chunks: handled }), {
    headers: { 'Content-Type': 'application/json' },
  });
});
