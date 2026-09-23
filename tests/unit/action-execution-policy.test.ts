import { describe, expect, it } from 'vitest';
import {
  isMeliWriteAction,
  preExecutionCapabilityBlock,
} from '../../supabase/functions/_shared/action-execution-policy';

describe('approved action pre-execution capability guard', () => {
  it('blocks stock and claim writes before the execution ledger is claimed', () => {
    expect(preExecutionCapabilityBlock('UPDATE_STOCK')).toBe('capability_disabled:UPDATE_STOCK');
    expect(preExecutionCapabilityBlock('EXECUTE_CLAIM_ACTION')).toBe(
      'capability_disabled:EXECUTE_CLAIM_ACTION',
    );
  });

  it('allows currently implemented MercadoLibre writes to proceed to idempotency claim', () => {
    expect(preExecutionCapabilityBlock('SEND_POST_SALE_MESSAGE')).toBeNull();
    expect(preExecutionCapabilityBlock('PAUSE_ITEM')).toBeNull();
  });

  it('does not classify internal-only actions as MercadoLibre writes', () => {
    expect(isMeliWriteAction('PRIORITIZE_DISPATCH')).toBe(false);
    expect(preExecutionCapabilityBlock('PRIORITIZE_DISPATCH')).toBeNull();
    expect(preExecutionCapabilityBlock('DRAFT_POST_SALE_MESSAGE')).toBeNull();
    expect(preExecutionCapabilityBlock('DRAFT_CLAIM_RESPONSE')).toBeNull();
  });
});
