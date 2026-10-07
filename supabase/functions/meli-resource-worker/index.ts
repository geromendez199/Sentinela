import { adminClient } from '../_shared/db.ts';
import { MeliClient } from '../_shared/meli-client.ts';
import { AccountRestrictedError, ReconnectRequiredError, RetryableError } from '../_shared/errors.ts';
import { requireInternalInvocation } from '../_shared/internal-auth.ts';
import { log } from '../_shared/logging.ts';
import { deadLetter, deleteMessage, readBatch, requeue, sendOnce } from '../_shared/queue.ts';
import { sanitizeText } from '../_shared/pii.ts';

/**
 * Resource worker (section 6.2).
 *
 * The webhook payload is only a pointer: this worker always fetches the current
 * resource from MercadoLibre and upserts it idempotently, guarded by the
 * external last_updated so an out-of-order delivery cannot roll state back.
 */

interface EventMessage {
  event_id: string;
  event_key: string;
  topic: string;
  resource: string;
  meli_account_id: string;
  org_id: string;
}

const QUEUE = 'meli_events';

function resourceId(resource: string): string | null {
  const match = /\/([^/]+)\/?$/.exec(resource);
  return match?.[1] ?? null;
}

async function markProcessed(eventId: string, status: string, error?: string): Promise<void> {
  await adminClient()
    .from('webhook_events')
    .update({ status, processed_at: new Date().toISOString(), processing_error: error ?? null })
    .eq('id', eventId);
}

async function handleOrder(client: MeliClient, message: EventMessage, orderId: string): Promise<void> {
  const order = await client.get<Record<string, unknown>>(`/orders/${orderId}`, {
    endpointClass: 'orders.get',
  });

  const lastUpdated = String(order.last_updated ?? order.date_created ?? new Date().toISOString());
  const shipping = order.shipping as { id?: number } | undefined;

  const { error } = await adminClient().rpc('backend_upsert_order', {
    p_org_id: message.org_id,
    p_account_id: message.meli_account_id,
    p_order_id: Number(orderId),
    p_pack_id: order.pack_id ?? null,
    p_shipment_id: shipping?.id ?? null,
    p_status: String(order.status ?? 'unknown'),
    p_tags: order.tags ?? [],
    p_date_created: order.date_created ?? null,
    p_date_closed: order.date_closed ?? null,
    p_source_last_updated: lastUpdated,
    p_total_amount: order.total_amount ?? null,
    p_currency_id: order.currency_id ?? null,
    p_order_items: order.order_items ?? [],
  });
  if (error) throw new RetryableError(`upsert_order_failed:${error.code ?? 'unknown'}`);

  await sendOnce('risk_jobs', `${message.event_key}:risk_score:order:${orderId}`, {
    job: 'risk_score',
    org_id: message.org_id,
    meli_account_id: message.meli_account_id,
    order_id: Number(orderId),
  });
}

async function handleShipment(client: MeliClient, message: EventMessage, shipmentId: string): Promise<void> {
  const shipment = await client.get<Record<string, unknown>>(`/shipments/${shipmentId}`, {
    endpointClass: 'shipments.get',
    headers: { 'x-format-new': 'true' },
  });

  let sla: Record<string, unknown> | null = null;
  try {
    sla = await client.get<Record<string, unknown>>(`/shipments/${shipmentId}/sla`, {
      endpointClass: 'shipments.sla',
    });
  } catch (error) {
    if (!(error instanceof Error && error.message.startsWith('meli_not_found'))) throw error;
  }

  const { error } = await adminClient().rpc('backend_upsert_shipment', {
    p_org_id: message.org_id,
    p_account_id: message.meli_account_id,
    p_shipment_id: Number(shipmentId),
    p_shipment: shipment,
    p_sla: sla,
  });
  if (error) throw new RetryableError(`upsert_shipment_failed:${error.code ?? 'unknown'}`);

  await sendOnce('risk_jobs', `${message.event_key}:risk_score:shipment:${shipmentId}`, {
    job: 'risk_score',
    org_id: message.org_id,
    meli_account_id: message.meli_account_id,
    shipment_id: Number(shipmentId),
  });
}

async function handleClaim(client: MeliClient, message: EventMessage, claimId: string): Promise<void> {
  const detail = await client.get<Record<string, unknown>>(`/post-purchase/v1/claims/${claimId}/detail`, {
    endpointClass: 'claims.detail',
  });

  let affects: Record<string, unknown> | null = null;
  try {
    affects = await client.get<Record<string, unknown>>(
      `/post-purchase/v1/claims/${claimId}/affects-reputation`,
      { endpointClass: 'claims.affects_reputation' },
    );
  } catch (error) {
    if (!(error instanceof Error && error.message.startsWith('meli_not_found'))) throw error;
  }

  const { error } = await adminClient().rpc('backend_upsert_claim', {
    p_org_id: message.org_id,
    p_account_id: message.meli_account_id,
    p_claim_id: Number(claimId),
    p_claim: detail,
    p_affects_reputation: affects,
  });
  if (error) throw new RetryableError(`upsert_claim_failed:${error.code ?? 'unknown'}`);

  // Reputation reconciliation is account-scoped and already runs every five
  // minutes. It intentionally does not create an unconsumed queue message.
}

async function handleMessages(client: MeliClient, message: EventMessage, packId: string): Promise<void> {
  const { data: account } = await adminClient()
    .from('meli_accounts')
    .select('seller_id')
    .eq('id', message.meli_account_id)
    .maybeSingle();
  if (!account) return;

  const conversation = await client.get<Record<string, unknown>>(
    `/messages/packs/${packId}/sellers/${account.seller_id}`,
    {
      endpointClass: 'messages.get',
      resourceClass: 'messaging',
      query: { tag: 'post_sale', mark_as_read: false },
    },
  );

  const messages = (conversation.messages ?? []) as Array<Record<string, unknown>>;
  const sanitized = messages.map((entry) => {
    const clean = sanitizeText(String(entry.text ?? ''));
    return {
      message_id: entry.id,
      text_sanitized: clean.text,
      injection_suspected: clean.injectionSuspected,
      from: entry.from ?? null,
      message_date: entry.message_date ?? null,
    };
  });

  const { error } = await adminClient().rpc('backend_upsert_messages', {
    p_org_id: message.org_id,
    p_account_id: message.meli_account_id,
    p_pack_id: Number(packId),
    p_conversation_status: conversation.conversation_status ?? null,
    p_messages: sanitized,
  });
  if (error) throw new RetryableError(`upsert_messages_failed:${error.code ?? 'unknown'}`);

  if (sanitized.length > 0) {
    await sendOnce('classification_jobs', `${message.event_key}:classify_text:${packId}`, {
      job: 'classify_text',
      org_id: message.org_id,
      meli_account_id: message.meli_account_id,
      source: 'message',
      pack_id: Number(packId),
    });
  }
}

async function handleItem(client: MeliClient, message: EventMessage, itemId: string): Promise<void> {
  const item = await client.get<Record<string, unknown>>(`/items/${itemId}`, {
    endpointClass: 'items.get',
  });
  const { error } = await adminClient().rpc('backend_upsert_item', {
    p_org_id: message.org_id,
    p_account_id: message.meli_account_id,
    p_item_id: itemId,
    p_item: item,
  });
  if (error) throw new RetryableError(`upsert_item_failed:${error.code ?? 'unknown'}`);
}

async function handleQuestion(client: MeliClient, message: EventMessage, questionId: string): Promise<void> {
  const question = await client.get<Record<string, unknown>>(`/questions/${questionId}`, {
    endpointClass: 'questions.get',
    query: { api_version: 4 },
  });
  const clean = sanitizeText(String(question.text ?? ''));

  const { error } = await adminClient().rpc('backend_upsert_question', {
    p_org_id: message.org_id,
    p_account_id: message.meli_account_id,
    p_question_id: Number(questionId),
    p_question: question,
    p_text_sanitized: clean.text,
  });
  if (error) throw new RetryableError(`upsert_question_failed:${error.code ?? 'unknown'}`);
}

async function process(message: EventMessage): Promise<void> {
  const client = new MeliClient(message.meli_account_id);
  const id = resourceId(message.resource);
  if (!id) throw new Error(`unparsable_resource:${message.resource}`);

  switch (message.topic) {
    case 'orders':
    case 'orders_v2':
      return handleOrder(client, message, id);
    case 'shipments':
      return handleShipment(client, message, id);
    case 'post_purchase':
    case 'claims':
      return handleClaim(client, message, id);
    case 'messages':
      return handleMessages(client, message, id);
    case 'items':
      return handleItem(client, message, id);
    case 'questions':
      return handleQuestion(client, message, id);
    default:
      return markProcessed(message.event_id, 'ignored');
  }
}

Deno.serve(async (request) => {
  const authError = await requireInternalInvocation(request);
  if (authError) return authError;

  const body = (await request.json().catch(() => ({}))) as { batch_size?: number };
  const batchSize = Math.min(50, Math.max(1, body.batch_size ?? 25));

  const messages = await readBatch<EventMessage>(QUEUE, 60, batchSize);
  let processed = 0;
  let requeued = 0;
  let deadLettered = 0;

  for (const entry of messages) {
    try {
      await process(entry.message);
      await markProcessed(entry.message.event_id, 'processed');
      await deleteMessage(QUEUE, entry.msg_id);
      processed += 1;
    } catch (error) {
      const failureClass = error instanceof Error ? error.constructor.name : 'UnknownError';
      const failureReason = error instanceof Error ? error.message : 'unknown_worker_error';

      if (entry.read_ct >= 3) {
        await deadLetter(QUEUE, entry, failureClass, failureReason);
        await markProcessed(entry.message.event_id, 'failed', failureReason);
        log('error', 'resource_worker_dead_lettered', {
          topic: entry.message.topic,
          meli_account_id: entry.message.meli_account_id,
          event_key: entry.message.event_key,
          attempts: entry.read_ct,
          failure_class: failureClass,
        });
        deadLettered += 1;
        continue;
      }

      if (error instanceof RetryableError) {
        const delay = Math.ceil((error.retryAfterMs ?? 5_000 * entry.read_ct) / 1000);
        await requeue(QUEUE, entry.msg_id, Math.min(900, Math.max(5, delay)));
        requeued += 1;
        continue;
      }
      if (error instanceof ReconnectRequiredError || error instanceof AccountRestrictedError) {
        await requeue(QUEUE, entry.msg_id, 60 * entry.read_ct);
        requeued += 1;
        continue;
      }
      log('error', 'resource_worker_failed', {
        topic: entry.message.topic,
        meli_account_id: entry.message.meli_account_id,
        failure_class: failureClass,
      });
      await requeue(QUEUE, entry.msg_id, 30 * entry.read_ct);
      requeued += 1;
    }
  }

  return new Response(JSON.stringify({ read: messages.length, processed, requeued, dead_lettered: deadLettered }), {
    headers: { 'Content-Type': 'application/json' },
  });
});
