const MELI_WRITE_ACTIONS = new Set([
  'SEND_POST_SALE_MESSAGE',
  'PAUSE_ITEM',
  'UPDATE_STOCK',
  'EXECUTE_CLAIM_ACTION',
]);

const IMPLEMENTED_MELI_WRITE_ACTIONS = new Set([
  'SEND_POST_SALE_MESSAGE',
  'PAUSE_ITEM',
]);

export function isMeliWriteAction(kind: string): boolean {
  return MELI_WRITE_ACTIONS.has(kind);
}

/**
 * Returns a fail-closed reason before an action-execution idempotency row is
 * claimed. Missing external write handlers must never leave a `started`
 * execution that can neither finish nor be safely retried.
 */
export function preExecutionCapabilityBlock(kind: string): string | null {
  if (isMeliWriteAction(kind) && !IMPLEMENTED_MELI_WRITE_ACTIONS.has(kind)) {
    return `capability_disabled:${kind}`;
  }
  return null;
}
