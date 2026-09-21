import { afterEach, describe, expect, it, vi } from 'vitest';
import { checkPolicy } from '@/lib/playbooks/policy-check';
import { decideMessaging } from '@/lib/playbooks/messaging-policy';

vi.mock('@/lib/env/server', () => ({
  meliWritesEnabled: () => globalThis.__writesEnabled === true,
  serverEnv: () => ({}),
  pkceEnabled: () => false,
}));

declare global {
  var __writesEnabled: boolean | undefined;
}

function input(overrides: Partial<Parameters<typeof checkPolicy>[0]> = {}) {
  return {
    actionType: 'PAUSE_ITEM' as const,
    accountStatus: 'active',
    approvedAt: new Date().toISOString(),
    approvedBy: 'user-1',
    killSwitches: { org: false, account: false },
    capabilities: { 'items.pause': { enabled: true, verification: 'verified' as const, note: '' } },
    policySnapshot: { item_status: 'active' },
    currentPolicy: { item_status: 'active' },
    invalidatingFields: ['item_status'],
    ...overrides,
  };
}

afterEach(() => {
  globalThis.__writesEnabled = undefined;
});

describe('final policy gate', () => {
  it('blocks every MercadoLibre write while the global switch is off', () => {
    globalThis.__writesEnabled = false;
    expect(checkPolicy(input())).toEqual({ allowed: false, reason: 'writes_disabled_globally' });
  });

  it('blocks when the resource changed after approval', () => {
    globalThis.__writesEnabled = true;
    const result = checkPolicy(input({ currentPolicy: { item_status: 'paused' } }));
    expect(result).toEqual({ allowed: false, reason: 'policy_changed:item_status' });
  });

  it('blocks when human approval is missing', () => {
    globalThis.__writesEnabled = true;
    expect(checkPolicy(input({ approvedBy: null, approvedAt: null }))).toEqual({
      allowed: false,
      reason: 'human_approval_missing',
    });
  });

  it('blocks an unverified capability', () => {
    globalThis.__writesEnabled = true;
    const result = checkPolicy(input({ capabilities: {} }));
    expect(result).toEqual({ allowed: false, reason: 'capability_disabled:items.pause' });
  });

  it('blocks an account that needs reconnection', () => {
    globalThis.__writesEnabled = true;
    expect(checkPolicy(input({ accountStatus: 'reconnect_required' }))).toEqual({
      allowed: false,
      reason: 'account_status:reconnect_required',
    });
  });

  it('allows a fully validated write', () => {
    globalThis.__writesEnabled = true;
    expect(checkPolicy(input())).toEqual({ allowed: true });
  });
});

describe('messaging policy', () => {
  it('blocks a message when the conversation is blocked', () => {
    const result = decideMessaging({
      actionGuide: {},
      caps: null,
      conversationBlocked: true,
      approvedText: 'Hola',
    });
    expect(result).toEqual({ allowed: false, reason: 'conversation_blocked' });
  });

  it('maps approved text to an option id when the guide offers one', () => {
    const result = decideMessaging({
      actionGuide: { options: [{ id: 'opt-1', text: 'Ya lo despachamos', template_id: 'tpl-1' }] },
      caps: { caps_available: 3 },
      conversationBlocked: false,
      approvedText: 'Ya lo despachamos',
    });
    expect(result).toEqual({ allowed: true, mode: 'option', optionId: 'opt-1', templateId: 'tpl-1' });
  });

  it('refuses free text when options exist and free text was not enabled', () => {
    const result = decideMessaging({
      actionGuide: { options: [{ id: 'opt-1', text: 'Otra respuesta' }] },
      caps: null,
      conversationBlocked: false,
      approvedText: 'Texto propio',
    });
    expect(result).toEqual({ allowed: false, reason: 'option_required' });
  });

  it('refuses a message over the documented length limit', () => {
    const result = decideMessaging({
      actionGuide: { free_text_enabled: true },
      caps: null,
      conversationBlocked: false,
      approvedText: 'a'.repeat(351),
    });
    expect(result).toEqual({ allowed: false, reason: 'text_too_long' });
  });

  it('refuses when the caps are exhausted', () => {
    const result = decideMessaging({
      actionGuide: { free_text_enabled: true },
      caps: { caps_available: 0 },
      conversationBlocked: false,
      approvedText: 'Hola',
    });
    expect(result).toEqual({ allowed: false, reason: 'caps_exhausted' });
  });
});
