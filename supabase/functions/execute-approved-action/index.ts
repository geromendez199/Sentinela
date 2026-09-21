import { adminClient, rpc } from '../_shared/db.ts';
import { loadEnv } from '../_shared/env.ts';
import { MeliClient } from '../_shared/meli-client.ts';
import { RetryableError } from '../_shared/errors.ts';
import { log } from '../_shared/logging.ts';
import { deleteMessage, readBatch, requeue } from '../_shared/queue.ts';

/**
 * Executes an approved action (section 8.4).
 *
 * Order of operations is non-negotiable:
 *   idempotency key -> refetch resource and current policy -> policy check ->
 *   token + rate budget -> write -> persist result -> audit -> verify.
 *
 * If the policy changed since approval the draft becomes blocked_policy with a
 * reason. There is no "temporary" shortcut.
 */

const QUEUE = 'derived_jobs';
const POST_SALE_MAX_CHARS = 350;

interface Job {
  job: string;
  action_draft_id: string;
  org_id: string;
  meli_account_id: string;
  correlation_id?: string;
}

interface Draft {
  id: string;
  org_id: string;
  meli_account_id: string;
  kind: string;
  status: string;
  approved_by: string | null;
  approved_at: string | null;
  payload_sanitized: Record<string, unknown>;
  policy_snapshot: Record<string, unknown>;
  rendered_text: string | null;
  item_id: string | null;
  claim_id: number | null;
  pack_id: number | null;
  idempotency_key: string;
}

async function block(draft: Draft, reason: string): Promise<void> {
  await adminClient()
    .from('action_drafts')
    .update({
      status: 'blocked_policy',
      error_code: reason,
      updated_at: new Date().toISOString(),
    })
    .eq('id', draft.id);

  await adminClient().from('security_audit_log').insert({
    org_id: draft.org_id,
    meli_account_id: draft.meli_account_id,
    action: 'action_blocked_policy',
    resource_type: 'action_draft',
    resource_id: draft.id,
    metadata: { reason },
  });

  log('warn', 'action_blocked_policy', { action_id: draft.id, reason });
}

async function executeSendMessage(draft: Draft, client: MeliClient): Promise<Record<string, unknown>> {
  const { data: account } = await adminClient()
    .from('meli_accounts')
    .select('seller_id')
    .eq('id', draft.meli_account_id)
    .maybeSingle();
  if (!account) throw new Error('account_missing');
  if (!draft.pack_id) throw new Error('pack_missing');

  // Re-read the action guide right before sending: an approved text does not
  // mean the message is still allowed (rule 15).
  const guide = await client.get<{
    blocked?: boolean;
    options?: Array<{ id?: string; text?: string; template_id?: string }>;
    free_text_enabled?: boolean;
  }>(`/messages/action_guide/packs/${draft.pack_id}`, {
    endpointClass: 'messages.action_guide',
    resourceClass: 'messaging',
    query: { tag: 'post_sale' },
  });

  if (guide.blocked === true) throw new PolicyError('action_guide_blocked');

  const caps = await client
    .get<{ caps_available?: number }>(`/messages/action_guide/packs/${draft.pack_id}/caps_available`, {
      endpointClass: 'messages.caps',
      resourceClass: 'messaging',
      query: { tag: 'post_sale' },
    })
    .catch(() => null);

  if (caps && typeof caps.caps_available === 'number' && caps.caps_available <= 0) {
    throw new PolicyError('caps_exhausted');
  }

  const text = (draft.rendered_text ?? '').trim();
  if (text.length === 0) throw new PolicyError('empty_text');
  if (text.length > POST_SALE_MAX_CHARS) throw new PolicyError('text_too_long');

  const option = (guide.options ?? []).find(
    (entry) => entry.text && entry.text.trim().toLowerCase() === text.toLowerCase(),
  );

  if (option?.id) {
    return client.request(`/messages/action_guide/packs/${draft.pack_id}/option`, {
      method: 'POST',
      endpointClass: 'messages.option',
      resourceClass: 'messaging',
      query: { tag: 'post_sale' },
      idempotencyKey: draft.idempotency_key,
      body: { option_id: option.id, template_id: option.template_id ?? undefined },
    });
  }

  if ((guide.options ?? []).length > 0 && guide.free_text_enabled !== true) {
    throw new PolicyError('option_required');
  }

  return client.request(`/messages/packs/${draft.pack_id}/sellers/${account.seller_id}`, {
    method: 'POST',
    endpointClass: 'messages.send',
    resourceClass: 'messaging',
    query: { tag: 'post_sale' },
    idempotencyKey: draft.idempotency_key,
    body: {
      from: { user_id: account.seller_id },
      text,
    },
  });
}

async function executePauseItem(draft: Draft, client: MeliClient): Promise<Record<string, unknown>> {
  if (!draft.item_id) throw new Error('item_missing');

  // Refetch: pausing an already paused or closed item is not the approved action.
  const item = await client.get<{ status?: string }>(`/items/${draft.item_id}`, {
    endpointClass: 'items.get',
  });
  const approvedStatus = (draft.policy_snapshot as { item_status?: string }).item_status;
  if (approvedStatus && item.status !== approvedStatus) {
    throw new PolicyError(`policy_changed:item_status`);
  }
  if (item.status === 'paused') throw new PolicyError('item_already_paused');

  return client.request(`/items/${draft.item_id}`, {
    method: 'PUT',
    endpointClass: 'items.pause',
    idempotencyKey: draft.idempotency_key,
    body: { status: 'paused' },
  });
}

class PolicyError extends Error {
  constructor(reason: string) {
    super(reason);
    this.name = 'PolicyError';
  }
}

async function execute(job: Job): Promise<void> {
  const env = loadEnv();

  const { data } = await adminClient()
    .from('action_drafts')
    .select('*')
    .eq('id', job.action_draft_id)
    .eq('org_id', job.org_id)
    .maybeSingle();

  const draft = data as Draft | null;
  if (!draft) return;
  if (draft.status !== 'executing' && draft.status !== 'approved') return;

  // Human approval is a hard precondition for every MercadoLibre write.
  const isWrite = ['SEND_POST_SALE_MESSAGE', 'PAUSE_ITEM', 'UPDATE_STOCK', 'EXECUTE_CLAIM_ACTION'].includes(
    draft.kind,
  );

  if (isWrite) {
    if (!env.writesEnabled) return block(draft, 'writes_disabled_globally');
    if (!draft.approved_by || !draft.approved_at) return block(draft, 'human_approval_missing');

    const { data: account } = await adminClient()
      .from('meli_accounts')
      .select('status')
      .eq('id', draft.meli_account_id)
      .maybeSingle();

    if (!account || ['reconnect_required', 'restricted', 'disconnected', 'onboarding'].includes(account.status)) {
      return block(draft, `account_status:${account?.status ?? 'missing'}`);
    }
  }

  const { data: execution } = await adminClient()
    .from('action_executions')
    .insert({
      org_id: draft.org_id,
      meli_account_id: draft.meli_account_id,
      action_draft_id: draft.id,
      idempotency_key: draft.idempotency_key,
      correlation_id: job.correlation_id ?? null,
    })
    .select('id')
    .maybeSingle();

  // A unique-violation means this exact write was already attempted.
  if (!execution) {
    log('info', 'action_execution_deduped', { action_id: draft.id });
    return;
  }

  const client = new MeliClient(draft.meli_account_id);

  try {
    let result: Record<string, unknown> = {};

    switch (draft.kind) {
      case 'SEND_POST_SALE_MESSAGE':
        result = await executeSendMessage(draft, client);
        break;
      case 'PAUSE_ITEM':
        result = await executePauseItem(draft, client);
        break;
      case 'PRIORITIZE_DISPATCH':
      case 'DRAFT_POST_SALE_MESSAGE':
      case 'DRAFT_CLAIM_RESPONSE':
        result = { internal: true };
        break;
      default:
        return block(draft, `capability_disabled:${draft.kind}`);
    }

    await adminClient()
      .from('action_drafts')
      .update({
        status: 'executed',
        executed_at: new Date().toISOString(),
        external_result: result,
        updated_at: new Date().toISOString(),
      })
      .eq('id', draft.id);

    await adminClient()
      .from('action_executions')
      .update({ outcome: 'executed', finished_at: new Date().toISOString() })
      .eq('id', execution.id);

    await adminClient().from('security_audit_log').insert({
      org_id: draft.org_id,
      meli_account_id: draft.meli_account_id,
      actor_user_id: draft.approved_by,
      action: 'action_executed',
      resource_type: 'action_draft',
      resource_id: draft.id,
      correlation_id: job.correlation_id ?? null,
      metadata: { kind: draft.kind },
    });
  } catch (error) {
    if (error instanceof PolicyError) {
      await adminClient()
        .from('action_executions')
        .update({ outcome: 'blocked_policy', error_class: error.message, finished_at: new Date().toISOString() })
        .eq('id', execution.id);
      return block(draft, error.message);
    }

    if (error instanceof RetryableError) throw error;

    await adminClient()
      .from('action_drafts')
      .update({
        status: 'failed',
        error_code: String(error).slice(0, 100),
        updated_at: new Date().toISOString(),
      })
      .eq('id', draft.id);

    await adminClient()
      .from('action_executions')
      .update({ outcome: 'failed', error_class: String(error).slice(0, 100), finished_at: new Date().toISOString() })
      .eq('id', execution.id);
  }
}

Deno.serve(async (request) => {
  const body = (await request.json().catch(() => ({}))) as { batch_size?: number };
  const messages = await readBatch<Job>(QUEUE, 120, Math.min(20, body.batch_size ?? 10));

  let executed = 0;
  for (const entry of messages) {
    if (entry.message.job !== 'execute_approved_action') continue;
    try {
      await execute(entry.message);
      await deleteMessage(QUEUE, entry.msg_id);
      executed += 1;
    } catch (error) {
      log('warn', 'action_execution_retry', { error: String(error) });
      if (entry.read_ct >= 3) await deleteMessage(QUEUE, entry.msg_id);
      else await requeue(QUEUE, entry.msg_id, 60 * entry.read_ct);
    }
  }

  return new Response(JSON.stringify({ executed }), { headers: { 'Content-Type': 'application/json' } });
});
