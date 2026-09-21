import { adminClient, rpc } from '../_shared/db.ts';
import { loadEnv } from '../_shared/env.ts';
import { MeliClient } from '../_shared/meli-client.ts';
import { log } from '../_shared/logging.ts';
import { sha256Hex } from '../_shared/pii.ts';

/**
 * Recovers notifications MercadoLibre could not deliver (section 6.4).
 * /missed_feeds retains roughly two days, so this must run every 10-15 minutes;
 * recovered pointers go through the same dedupe and queue as live webhooks.
 */

interface MissedFeed {
  topic?: string;
  resource?: string;
  user_id?: number;
  sent?: string;
  received?: string;
  application_id?: number;
  actions?: string[];
}

Deno.serve(async () => {
  const env = loadEnv();
  const { data: accounts } = await adminClient()
    .from('meli_accounts')
    .select('id, org_id, seller_id, site_id, status')
    .in('status', ['active', 'backfilling', 'degraded']);

  let recovered = 0;
  let duplicates = 0;

  for (const account of accounts ?? []) {
    const client = new MeliClient(account.id);
    try {
      const feeds = await client.get<MissedFeed[] | { missed_feeds?: MissedFeed[] }>('/missed_feeds', {
        endpointClass: 'missed_feeds',
        // The items topic may require site_id; the capability flag decides.
        query: { app_id: env.meliAppId },
      });

      const entries = Array.isArray(feeds) ? feeds : (feeds.missed_feeds ?? []);

      for (const feed of entries) {
        if (!feed.topic || !feed.resource || feed.user_id === undefined) continue;

        const eventKey = await sha256Hex(
          `${feed.topic}|${feed.resource}|${feed.user_id}|${feed.sent ?? ''}|${[...(feed.actions ?? [])].sort().join(',')}`,
        );

        const inserted = await rpc<boolean>('backend_ingest_webhook', {
          p_event_key: eventKey,
          p_topic: feed.topic,
          p_resource: feed.resource,
          p_user_id: account.seller_id,
          p_application_id: Number(env.meliAppId),
          p_meli_account_id: account.id,
          p_org_id: account.org_id,
          p_sent_at: feed.sent ?? null,
          p_attempts: null,
          p_actions: feed.actions ?? [],
        });

        if (inserted) recovered += 1;
        else duplicates += 1;
      }

      await rpc('backend_record_metric', {
        p_name: 'missed_feeds_sweep_ok',
        p_value: 1,
        p_org_id: account.org_id,
        p_meli_account_id: account.id,
        p_labels: {},
      });
    } catch (error) {
      log('warn', 'missed_feeds_failed', { meli_account_id: account.id, error: String(error) });
    }
  }

  return new Response(JSON.stringify({ recovered, duplicates }), {
    headers: { 'Content-Type': 'application/json' },
  });
});
