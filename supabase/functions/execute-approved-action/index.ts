import { isMeliWriteAction, preExecutionCapabilityBlock } from '../_shared/action-execution-policy.ts';
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
const EXECUTION_STALE_SECONDS = 90;
const MAX_EXECUTION_READS = 3;

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

interface ExecutionClaim {
  execution_id: string;
  attempt: number;
  should_execute: boolean;
  claim_state: string;
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

async function claimExecution(draft: Draft, job: Job): Promise<ExecutionClaim> {
  const { data, error } = await adminClient().rpc('backend_claim_action_execution', {
    p_org_id: draft.org_id,
    p_account_id: draft.meli_account_id,
    p_action_id: draft.id,
    p_idempotency_key: draft.idempotency_key,
    p_correlation_id: job.correlation_id ?? null,
    p_stale_after_seconds: EXECUTION_STALE_SECONDS,
  });

  if (error) throw new RetryableError(`action_execution_claim_failed:${error.code ?? 'unknown'}`);
  const rows = data as ExecutionClaim[] | ExecutionClaim | null;
  const claim = Array.isArray(rows) ? rows[0] : rows;
  if (!claim) throw new RetryableError('action_execution_claim_empty');
  return claim;
}

async function recordRetryableFailure(executionId: string, error: RetryableError): Promise<void> {
  const { error: updateError } = await adminClient()
    .from('action_executions')
    .update({ error_class: error.message.slice(0, 100) })
    .eq('id', executionId)
    .eq('outcome', 'started')
    .is('finished_at', null);

  if (updateError) {
    log('error', 'action_retry_state_persist_failed', {
      execution_id: executionId,
      error: updateError.code ?? 'unknown',
    });
  }
}

async function markRetryExhausted(job: Job, error: unknown): Promise<void> {
  const reason = String(error).slice(0, 500);
  const { data } = await adminClient()
    .from('action_drafts')
    .select('id, org_id, meli_account_id, approved_by, status')
    .eq('id', job.action_draft_id)
    .eq('org_id', job.org_id)
    .maybeSingle();

  if (!data || data.status === 'executed' || data.status === 'blocked_policy') return;

  await adminClient()
    .from('action_executions')
    .update({ outcome: 'failed', error_class: reason.slice(0, 100), finished_at: new Date().toISOString() })
    .eq('action_draft_id', job.action_draft_id)
    .eq('outcome', 'started')
    .is('finished_at', null);

  await adminClient()
    .from('action_drafts')
    .update({
      status: 'failed',
      error_code: 'retry_exhausted',
      error_message: reason,
      updated_at: new Date().toISOString(),
    })
    .eq('id', job.action_draft_id)
    .in('status', ['approved', 'executing']);

  await adminClient().from('security_audit_log').insert({
    org_id: data.org_id,
    meli_account_id: data.meli_account_id,
    actor_user_id: data.approved_by,
    action: 'action_execution_failed',
    resource_type: 'action_draft',
    resource_id: data.id,
    correlation_id: job.correlation_id ?? null,
    metadata: { reason: 'retry_exhausted' },
  });
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

  // Missing external write handlers are rejected before claiming an idempotency
  // execution row. B6 may enable them only after the handler and contract flag exist.
  const capabilityBlock = preExecutionCapabilityBlock(draft.kind);
  if (capabilityBlock) return block(draft, capabilityBlock);

  const isWrite = isMeliWriteAction(draft.kind);

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

  const execution = await claimExecution(draft, job);
  if (!execution.should_execute) {
    if (execution.claim_state === 'in_progress') {
      throw new RetryableError('action_execution_in_progress', 30_000);
    }
    log('info', 'action_execution_deduped', {
      action_id: draft.id,
      execution_id: execution.execution_id,
      state: execution.claim_state,
      attempt: execution.attempt,
    });
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
      .eq('id', execution.execution_id);

    await adminClient().from('security_audit_log').insert({
      org_id: draft.org_id,
      meli_account_id: draft.meli_account_id,
      actor_user_id: draft.approved_by,
      action: 'action_executed',
      resource_type: 'action_draft',
      resource_id: draft.id,
      correlation_id: job.correlation_id ?? null,
      metadata: { kind: draft.kind, attempt: execution.attempt },
    });
  } catch (error) {
    if (error instanceof PolicyError) {
      await adminClient()
        .from('action_executions')
        .update({ outcome: 'blocked_policy', error_class: error.message, finished_at: new Date().toISOString() })
        .eq('id', execution.execution_id);
      return block(draft, error.message);
    }

    if (error instanceof RetryableError) {
      await recordRetryableFailure(execution.execution_id, error);
      throw error;
    }

    await adminClient()
      .from('action_drafts')
      .update({ status: 'failed', error_code: String(error).slice(0, 100), updated_at: new Date().toISOString() })
      .eq('id', draft.id);

    await adminClient()
      .from('action_executions')
      .update({ outcome: 'failed', error_class: String(error).slice(0, 100), finished_at: new Date().toISOString() })
      .eq('id', execution.execution_id);
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
      log('warn', 'action_execution_retry', { error: String(error), read_ct: entry.read_ct });

      if (error instanceof RetryableError && error.message === 'action_execution_in_progress') {
        const delay = Math.ceil((error.retryAfterMs ?? 30_000) / 1000);
        await requeue(QUEUE, entry.msg_id, Math.max(15, delay));
        continue;
      }

      if (entry.read_ct >= MAX_EXECUTION_READS) {
        await markRetryExhausted(entry.message, error);
        await deleteMessage(QUEUE, entry.msg_id);
      } else {
        const retryAfterMs = error instanceof RetryableError ? error.retryAfterMs : null;
        const delay = Math.ceil((retryAfterMs ?? 60_000 * entry.read_ct) / 1000);
        await requeue(QUEUE, entry.msg_id, Math.min(900, Math.max(30, delay)));
      }
    }
  }

  return new Response(JSON.stringify({ executed }), { headers: { 'Content-Type': 'application/json' } });
});
