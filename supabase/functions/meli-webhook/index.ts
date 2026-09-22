import { adminClient, rpc } from '../_shared/db.ts';
import { loadWebhookEnv } from '../_shared/env.ts';
import { log } from '../_shared/logging.ts';
import { sha256Hex } from '../_shared/pii.ts';

/**
 * Webhook ingress. Must ACK 200 within 500 ms (section 6.1), so this function
 * only validates cheaply, dedupes, records and enqueues. It never refreshes a
 * token, calls MercadoLibre, invokes the LLM or sends a notification.
 */

const ALLOWED_TOPICS = new Set([
  'orders_v2',
  'orders',
  'shipments',
  'messages',
  'post_purchase',
  'claims',
  'items',
  'questions',
  'stock-locations',
  'user-products_family',
  'flex-handshakes',
]);

const MAX_BODY_BYTES = 16_384;

interface Envelope {
  _id?: string;
  resource?: string;
  user_id?: number | string;
  topic?: string;
  application_id?: number | string;
  attempts?: number;
  sent?: string;
  actions?: string[];
}

function ack(body: Record<string, unknown>, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

function stableActions(actions: string[] | undefined): string {
  return [...(actions ?? [])].sort().join(',');
}

Deno.serve(async (request) => {
  const startedAt = Date.now();
  const env = loadWebhookEnv();

  if (request.method !== 'POST') return ack({ error: 'method_not_allowed' }, 405);

  const segments = new URL(request.url).pathname.split('/').filter(Boolean);
  if (segments[segments.length - 1] !== env.webhookRouteSecret) {
    return ack({ error: 'not_found' }, 404);
  }

  const raw = await request.text();
  if (raw.length > MAX_BODY_BYTES) return ack({ error: 'payload_too_large' }, 413);

  let payload: Envelope;
  try {
    payload = JSON.parse(raw) as Envelope;
  } catch {
    return ack({ error: 'invalid_json' }, 400);
  }

  if (!payload.topic || !payload.resource || payload.user_id === undefined) {
    return ack({ error: 'invalid_envelope' }, 400);
  }
  if (String(payload.application_id ?? '') !== env.meliAppId) {
    log('warn', 'webhook_wrong_application', { topic: payload.topic });
    return ack({ status: 'ignored' });
  }
  if (!ALLOWED_TOPICS.has(payload.topic)) {
    return ack({ status: 'ignored_topic' });
  }

  const sellerId = Number(payload.user_id);
  const { data: account } = await adminClient()
    .from('meli_accounts')
    .select('id, org_id, status')
    .eq('seller_id', sellerId)
    .maybeSingle();

  if (!account) {
    await adminClient().from('webhook_events').insert({
      event_key: `unknown:${sellerId}:${payload.resource}:${payload.sent ?? ''}`,
      topic: payload.topic,
      resource: payload.resource,
      user_id: sellerId,
      status: 'security_rejected',
    });
    return ack({ status: 'unknown_account' });
  }

  const eventKey = payload._id
    ? `${env.meliAppId}:${payload._id}`
    : await sha256Hex(
        `${payload.topic}|${payload.resource}|${sellerId}|${payload.sent ?? ''}|${stableActions(payload.actions)}`,
      );

  try {
    const inserted = await rpc<boolean>('backend_ingest_webhook', {
      p_event_key: eventKey,
      p_topic: payload.topic,
      p_resource: payload.resource,
      p_user_id: sellerId,
      p_application_id: Number(env.meliAppId),
      p_meli_account_id: account.id,
      p_org_id: account.org_id,
      p_sent_at: payload.sent ?? null,
      p_attempts: payload.attempts ?? null,
      p_actions: payload.actions ?? [],
    });

    log('info', 'webhook_acked', {
      topic: payload.topic,
      meli_account_id: account.id,
      duplicate: !inserted,
      ack_ms: Date.now() - startedAt,
    });

    return ack({ status: inserted ? 'queued' : 'duplicate' });
  } catch (error) {
    log('error', 'webhook_ingest_failed', { topic: payload.topic, error: String(error) });
    return ack({ error: 'ingest_failed' }, 500);
  }
});
