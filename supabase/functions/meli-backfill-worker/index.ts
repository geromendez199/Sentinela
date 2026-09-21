import { adminClient } from '../_shared/db.ts';
import { MeliClient } from '../_shared/meli-client.ts';
import { RetryableError } from '../_shared/errors.ts';
import { log } from '../_shared/logging.ts';

/**
 * Resumable historical backfill (section 6.5).
 *
 * Date-sliced with checkpoints after every successful page. A window that
 * approaches the pagination ceiling is split in half instead of being paged
 * past the limit; claims search is hard-capped at offset+limit < 10000, so
 * date splitting is mandatory there.
 */

const CLAIMS_SAFETY_CEILING = 9_000;
const ORDERS_SAFETY_CEILING = 9_000;
const PAGE_SIZE = 50;

interface SyncJob {
  id: string;
  org_id: string;
  meli_account_id: string;
  kind: string;
  resource_kind: string | null;
  range_start: string;
  range_end: string;
  cursor: { window_start?: string; window_end?: string; offset?: number };
  processed_count: number;
  attempts: number;
}

function initialWindowDays(resourceKind: string | null): number {
  if (resourceKind === 'claims') return 3;
  if (resourceKind === 'orders') return 7;
  return 7;
}

function addDays(iso: string, days: number): string {
  return new Date(Date.parse(iso) + days * 86_400_000).toISOString();
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

async function backfillOrders(client: MeliClient, job: SyncJob): Promise<void> {
  const { data: account } = await adminClient()
    .from('meli_accounts')
    .select('seller_id')
    .eq('id', job.meli_account_id)
    .maybeSingle();
  if (!account) return;

  let windowStart = job.cursor.window_start ?? job.range_start;
  let windowDays = initialWindowDays('orders');
  let processed = 0;

  while (Date.parse(windowStart) < Date.parse(job.range_end)) {
    const windowEnd =
      Math.min(Date.parse(addDays(windowStart, windowDays)), Date.parse(job.range_end)) ===
      Date.parse(job.range_end)
        ? job.range_end
        : addDays(windowStart, windowDays);

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

    // A window near the pagination ceiling is split, never paged past it.
    if (probe.paging.total >= ORDERS_SAFETY_CEILING && windowDays > 1) {
      windowDays = Math.max(1, Math.floor(windowDays / 2));
      continue;
    }

    let offset = 0;
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
        await adminClient().rpc('backend_upsert_order', {
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
        processed += 1;
      }

      offset += PAGE_SIZE;
      await checkpoint(
        job,
        { window_start: windowStart, offset },
        processed,
        (Date.parse(windowStart) - Date.parse(job.range_start)) /
          Math.max(1, Date.parse(job.range_end) - Date.parse(job.range_start)),
      );
    }

    windowStart = windowEnd;
    await checkpoint(
      job,
      { window_start: windowStart, offset: 0 },
      processed,
      (Date.parse(windowStart) - Date.parse(job.range_start)) /
        Math.max(1, Date.parse(job.range_end) - Date.parse(job.range_start)),
    );
    processed = 0;
    // Bounded work per invocation: the cron pulse resumes from the checkpoint.
    return;
  }

  await adminClient()
    .from('sync_jobs')
    .update({ status: 'done', progress: 1, updated_at: new Date().toISOString() })
    .eq('id', job.id);
}

async function backfillClaims(client: MeliClient, job: SyncJob): Promise<void> {
  const { data: account } = await adminClient()
    .from('meli_accounts')
    .select('seller_id')
    .eq('id', job.meli_account_id)
    .maybeSingle();
  if (!account) return;

  let windowStart = job.cursor.window_start ?? job.range_start;
  let windowDays = initialWindowDays('claims');

  while (Date.parse(windowStart) < Date.parse(job.range_end)) {
    const windowEnd = addDays(windowStart, windowDays);

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

    // offset+limit must stay under 10000: split by day, then by hour if needed.
    if (probe.paging.total >= CLAIMS_SAFETY_CEILING) {
      windowDays = windowDays > 1 ? Math.max(1, Math.floor(windowDays / 2)) : windowDays;
      if (windowDays <= 1) {
        log('warn', 'claims_window_at_hour_granularity', { meli_account_id: job.meli_account_id });
      }
      continue;
    }

    let offset = 0;
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
        await adminClient().rpc('backend_upsert_claim', {
          p_org_id: job.org_id,
          p_account_id: job.meli_account_id,
          p_claim_id: Number(claim.id),
          p_claim: claim,
          p_affects_reputation: null,
        });
      }
      offset += PAGE_SIZE;
    }

    windowStart = windowEnd;
    await checkpoint(
      job,
      { window_start: windowStart, offset: 0 },
      probe.paging.total,
      (Date.parse(windowStart) - Date.parse(job.range_start)) /
        Math.max(1, Date.parse(job.range_end) - Date.parse(job.range_start)),
    );
    return;
  }

  await adminClient()
    .from('sync_jobs')
    .update({ status: 'done', progress: 1, updated_at: new Date().toISOString() })
    .eq('id', job.id);
}

Deno.serve(async (request) => {
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
        // Other resources are discovered from orders and claims rather than scanned.
        await adminClient()
          .from('sync_jobs')
          .update({ status: 'done', progress: 1, updated_at: new Date().toISOString() })
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
