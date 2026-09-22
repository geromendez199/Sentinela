import { adminClient, rpc } from '../_shared/db.ts';
import { loadMeliOAuthEnv } from '../_shared/env.ts';
import { requireInternalInvocation } from '../_shared/internal-auth.ts';
import { MeliClient } from '../_shared/meli-client.ts';
import { log } from '../_shared/logging.ts';
import { sha256Hex } from '../_shared/pii.ts';

/**
 * Recovers notifications MercadoLibre could not deliver (section 6.4).
 *
 * Official missed-feeds semantics currently retain roughly two days and return
 * only a small page by default. The items topic additionally requires site_id,
 * so it is swept explicitly per site. Every recovered pointer is attributed by
 * the feed's own user_id, never by the account whose token happened to perform
 * the app-level lookup.
 */

interface MissedFeed {
  _id?: string;
  topic?: string;
  resource?: string;
  user_id?: number | string;
  sent?: string;
  received?: string;
  application_id?: number;
  attempts?: number;
  actions?: string[];
}

interface MissedFeedPage {
  messages?: MissedFeed[];
  missed_feeds?: MissedFeed[];
  paging?: { total?: number; offset?: number; limit?: number };
}

interface AccountRow {
  id: string;
  org_id: string;
  seller_id: number;
  site_id: string;
  status: string;
}

const PAGE_SIZE = 50;
const MAX_PAGES = 40;

function entriesFrom(payload: MissedFeed[] | MissedFeedPage): MissedFeed[] {
  if (Array.isArray(payload)) return payload;
  return payload.messages ?? payload.missed_feeds ?? [];
}

async function fetchPages(
  client: MeliClient,
  appId: string,
  extraQuery: Record<string, string | number> = {},
): Promise<MissedFeed[]> {
  const collected: MissedFeed[] = [];

  for (let page = 0; page < MAX_PAGES; page++) {
    const offset = page * PAGE_SIZE;
    const payload = await client.get<MissedFeed[] | MissedFeedPage>('/missed_feeds', {
      endpointClass: 'missed_feeds',
      query: { app_id: appId, offset, limit: PAGE_SIZE, ...extraQuery },
    });

    const entries = entriesFrom(payload);
    collected.push(...entries);

    const total = Array.isArray(payload) ? undefined : payload.paging?.total;
    if (entries.length < PAGE_SIZE) break;
    if (typeof total === 'number' && offset + entries.length >= total) break;
  }

  return collected;
}

async function ingestFeed(
  feed: MissedFeed,
  envAppId: string,
  accountBySeller: Map<number, AccountRow>,
): Promise<'recovered' | 'duplicate' | 'ignored'> {
  if (!feed.topic || !feed.resource || feed.user_id === undefined) return 'ignored';

  const sellerId = Number(feed.user_id);
  if (!Number.isFinite(sellerId)) return 'ignored';

  const target = accountBySeller.get(sellerId);
  if (!target) {
    log('warn', 'missed_feed_unknown_account', { topic: feed.topic, seller_id: sellerId });
    return 'ignored';
  }

  // Never accept a feed for another application, even if an upstream response
  // unexpectedly contains it.
  if (feed.application_id !== undefined && String(feed.application_id) !== envAppId) {
    log('warn', 'missed_feed_wrong_application', { topic: feed.topic, seller_id: sellerId });
    return 'ignored';
  }

  const eventKey = feed._id
    ? `${envAppId}:${feed._id}`
    : await sha256Hex(
        `${feed.topic}|${feed.resource}|${sellerId}|${feed.sent ?? ''}|${[...(feed.actions ?? [])].sort().join(',')}`,
      );

  const inserted = await rpc<boolean>('backend_ingest_webhook', {
    p_event_key: eventKey,
    p_topic: feed.topic,
    p_resource: feed.resource,
    p_user_id: sellerId,
    p_application_id: Number(envAppId),
    p_meli_account_id: target.id,
    p_org_id: target.org_id,
    p_sent_at: feed.sent ?? null,
    p_attempts: feed.attempts ?? null,
    p_actions: feed.actions ?? [],
  });

  return inserted ? 'recovered' : 'duplicate';
}

Deno.serve(async (request) => {
  const authError = await requireInternalInvocation(request);
  if (authError) return authError;

  const env = loadMeliOAuthEnv();
  const { data: rows } = await adminClient()
    .from('meli_accounts')
    .select('id, org_id, seller_id, site_id, status')
    .in('status', ['active', 'backfilling', 'degraded']);

  const accounts = (rows ?? []) as AccountRow[];
  const accountBySeller = new Map(accounts.map((account) => [Number(account.seller_id), account]));

  let recovered = 0;
  let duplicates = 0;
  let ignored = 0;

  for (const account of accounts) {
    const client = new MeliClient(account.id);

    try {
      // General history. Current documentation permits topic filtering and
      // pagination; this request covers all non-segmented topics.
      const general = await fetchPages(client, env.meliAppId);

      // Items is segmented by site and now requires site_id when that topic is
      // requested explicitly. The shared dedupe key makes overlap harmless.
      const items = await fetchPages(client, env.meliAppId, {
        topic: 'items',
        site_id: account.site_id,
      });

      for (const feed of [...general, ...items]) {
        const outcome = await ingestFeed(feed, env.meliAppId, accountBySeller);
        if (outcome === 'recovered') recovered += 1;
        else if (outcome === 'duplicate') duplicates += 1;
        else ignored += 1;
      }

      await rpc('backend_record_metric', {
        p_name: 'missed_feeds_sweep_ok',
        p_value: 1,
        p_org_id: account.org_id,
        p_meli_account_id: account.id,
        p_labels: { site_id: account.site_id },
      });
    } catch (error) {
      log('warn', 'missed_feeds_failed', { meli_account_id: account.id, error: String(error) });
    }
  }

  return new Response(JSON.stringify({ recovered, duplicates, ignored }), {
    headers: { 'Content-Type': 'application/json' },
  });
});
