import { adminClient } from '../_shared/db.ts';
import { loadWritePolicyEnv } from '../_shared/env.ts';
import { RetryableError } from '../_shared/errors.ts';
import { requireInternalInvocation } from '../_shared/internal-auth.ts';
import { log } from '../_shared/logging.ts';
import { MeliClient } from '../_shared/meli-client.ts';
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

interface ActionGuideTemplate {
  id: string;
  vars?: Array<{ id: string; type?: string }> | null;
}

interface ActionGuideOption {
  id: string;
  enabled?: boolean;
  actionable?: boolean;
  type?: string;
  char_limit?: number | null;
  cap_available?: number;
  templates?: ActionGuideTemplate[] | null;
}

interface CapEntry {
  option_id: string;
  cap_available: number;
}

async function block(draft: Draft, reason: string): Promise<void> {
  await adminClient()
    .from('action_drafts')
    .update({ status: 'blocked_policy', error_code: reason, updated_at: new Date().toISOString() })
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

function requestedMessagingOption(draft: Draft): string {
  const option = draft.payload_sanitized.option_id;
  if (typeof option === 'string' && option.trim()) return option.trim();

  // Backward-compatible drafts with only approved free text map to OTHER. This
  // is still revalidated against the current action guide before the write.
  if ((draft.rendered_text ?? '').trim()) return 'OTHER';
  throw new PolicyError('messaging_option_missing');
}

function approvedVars(draft: Draft): Array<{ id: string; value: string | number }> | undefined {
  const value = draft.payload_sanitized.vars;
  if (!Array.isArray(value)) return undefined;

  const result: Array<{ id: string; value: string | number }> = [];
  for (const entry of value) {
    if (!entry || typeof entry !== 'object') throw new PolicyError('messaging_vars_invalid');
    const record = entry as Record<string, unknown>;
    if (typeof record.id !== 'string') throw new PolicyError('messaging_vars_invalid');
    if (typeof record.value !== 'string' && typeof record.value !== 'number') {
      throw new PolicyError('messaging_vars_invalid');
    }
    result.push({ id: record.id, value: record.value });
  }
  return result;
}

async function executeSendMessage(draft: Draft, client: MeliClient): Promise<Record<string, unknown>> {
  if (!draft.pack_id) throw new Error('pack_missing');

  const guide = await client.get<{ options?: ActionGuideOption[] }>(
    `/messages/action_guide/packs/${draft.pack_id}`,
    {
      endpointClass: 'messages.action_guide',
      resourceClass: 'messaging',
      query: { tag: 'post_sale' },
    },
  );

  const optionId = requestedMessagingOption(draft);
  const option = (guide.options ?? []).find((candidate) => candidate.id === optionId);
  if (!option) throw new PolicyError(`messaging_option_unavailable:${optionId}`);
  if (option.enabled === false || option.actionable === false) {
    throw new PolicyError(`messaging_option_not_actionable:${optionId}`);
  }

  // Current official contract returns an array keyed by option_id.
  const caps = await client.get<CapEntry[]>(
    `/messages/action_guide/packs/${draft.pack_id}/caps_available`,
    {
      endpointClass: 'messages.caps',
      resourceClass: 'messaging',
      query: { tag: 'post_sale' },
    },
  );
  const currentCap = caps.find((entry) => entry.option_id === optionId)?.cap_available ?? 0;
  if (currentCap <= 0) throw new PolicyError(`caps_exhausted:${optionId}`);

  const body: Record<string, unknown> = { option_id: optionId };

  if ((option.type ?? '').toLowerCase() === 'free_text') {
    const text = (draft.rendered_text ?? '').trim();
    if (!text) throw new PolicyError('empty_text');
    const charLimit = Math.min(option.char_limit ?? POST_SALE_MAX_CHARS, POST_SALE_MAX_CHARS);
    if (text.length > charLimit) throw new PolicyError(`text_too_long:${charLimit}`);
    body.text = text;
  } else {
    const templateId = draft.payload_sanitized.template_id;
    if (typeof templateId !== 'string' || !templateId) {
      throw new PolicyError(`template_required:${optionId}`);
    }
    if (!(option.templates ?? []).some((template) => template.id === templateId)) {
      throw new PolicyError(`template_unavailable:${templateId}`);
    }
    body.template_id = templateId;

    const vars = approvedVars(draft);
    if (vars?.length) body.vars = vars;
  }

  return client.request(`/messages/action_guide/packs/${draft.pack_id}/option`, {
    method: 'POST',
    endpointClass: 'messages.option',
    resourceClass: 'messaging',
    query: { tag: 'post_sale' },
    idempotencyKey: draft.idempotency_key,
    body,
  });
}

async function executePauseItem(draft: Draft, client: MeliClient): Promise<Record<string, unknown>> {
  if (!draft.item_id) throw new Error('item_missing');

  const item = await client.get<{ status?: string }>(`/items/${draft.item_id}`, {
    endpointClass: 'items.get',
  });
  const approvedStatus = (draft.policy_snapshot as { item_status?: string }).item_status;
  if (approvedStatus && item.status !== approvedStatus) {
    throw new PolicyError('policy_changed:item_status');
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
  const { writesEnabled } = loadWritePolicyEnv();

  const { data } = await adminClient()
    .from('action_drafts')
    .select('*')
    .eq('id', job.action_draft_id)
    .eq('org_id', job.org_id)
    .maybeSingle();

  const draft = data as Draft | null;
  if (!draft) return;
  if (draft.status !== 'executing' && draft.status !== 'approved') return;

  const isWrite = ['SEND_POST_SALE_MESSAGE', 'PAUSE_ITEM', 'UPDATE_STOCK', 'EXECUTE_CLAIM_ACTION'].includes(
    draft.kind,
  );

  if (isWrite) {
    if (!writesEnabled) return block(draft, 'writes_disabled_globally');
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
      .update({ status: 'executed', executed_at: new Date().toISOString(), external_result: result, updated_at: new Date().toISOString() })
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
      .update({ status: 'failed', error_code: String(error).slice(0, 100), updated_at: new Date().toISOString() })
      .eq('id', draft.id);

    await adminClient()
      .from('action_executions')
      .update({ outcome: 'failed', error_class: String(error).slice(0, 100), finished_at: new Date().toISOString() })
      .eq('id', execution.id);
  }
}

Deno.serve(async (request) => {
  const authError = await requireInternalInvocation(request);
  if (authError) return authError;

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
