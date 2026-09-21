import { meliWritesEnabled } from '@/lib/env/server';
import { isCapabilityEnabled, type Capability, type CapabilityKey } from '@/lib/meli/capabilities';
import { ACTION_CATALOG, isMeliWrite, type ActionType } from './action-catalog';

/**
 * Final gate, evaluated immediately before a write (section 8.4). Anything that
 * changed since approval turns the draft into `blocked_policy` with a reason,
 * never into a best-effort attempt.
 */
export interface PolicyCheckInput {
  actionType: ActionType;
  accountStatus: string;
  approvedAt: string | null;
  approvedBy: string | null;
  killSwitches: { org: boolean; account: boolean };
  capabilities: Partial<Record<CapabilityKey, Capability>>;
  /** Snapshot taken at approval time vs. the resource refetched just now. */
  policySnapshot: Record<string, unknown>;
  currentPolicy: Record<string, unknown>;
  /** Fields whose change invalidates the approval. */
  invalidatingFields: string[];
}

export type PolicyResult = { allowed: true } | { allowed: false; reason: string };

const CAPABILITY_BY_ACTION: Partial<Record<ActionType, CapabilityKey>> = {
  SEND_POST_SALE_MESSAGE: 'messages.send',
  PAUSE_ITEM: 'items.pause',
  UPDATE_STOCK: 'stock.user_product_update',
  EXECUTE_CLAIM_ACTION: 'claims.execute_action',
};

const WRITE_BLOCKING_STATUSES = new Set([
  'reconnect_required',
  'restricted',
  'disconnected',
  'onboarding',
]);

export function checkPolicy(input: PolicyCheckInput): PolicyResult {
  const definition = ACTION_CATALOG[input.actionType];

  if (isMeliWrite(input.actionType)) {
    if (!meliWritesEnabled()) return { allowed: false, reason: 'writes_disabled_globally' };
    if (input.killSwitches.org) return { allowed: false, reason: 'kill_switch_org' };
    if (input.killSwitches.account) return { allowed: false, reason: 'kill_switch_account' };
    if (WRITE_BLOCKING_STATUSES.has(input.accountStatus)) {
      return { allowed: false, reason: `account_status:${input.accountStatus}` };
    }

    const capability = CAPABILITY_BY_ACTION[input.actionType];
    if (capability && !isCapabilityEnabled(input.capabilities, capability)) {
      return { allowed: false, reason: `capability_disabled:${capability}` };
    }
  }

  if (definition.requiresHumanApproval && (!input.approvedBy || !input.approvedAt)) {
    return { allowed: false, reason: 'human_approval_missing' };
  }

  for (const field of input.invalidatingFields) {
    const before = JSON.stringify(input.policySnapshot[field] ?? null);
    const now = JSON.stringify(input.currentPolicy[field] ?? null);
    if (before !== now) return { allowed: false, reason: `policy_changed:${field}` };
  }

  return { allowed: true };
}

/** Deterministic idempotency key so a retried execution never doubles a write. */
export function idempotencyKey(actionDraftId: string, attempt: number): string {
  return `action:${actionDraftId}:${attempt}`;
}
