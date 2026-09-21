/**
 * Capability flags for everything the specification marks [NO VERIFICADO].
 *
 * Rule 2: an unverified contract ships behind a flag with an empirical test
 * plan, never as production behaviour. `verify-meli-contracts.ts` flips these
 * only for the sites and flows that passed a live contract test.
 */
export type CapabilityKey =
  | 'claims.write_messages'
  | 'claims.execute_action'
  | 'returns.attachments'
  | 'questions.answer'
  | 'items.pause'
  | 'stock.user_product_update'
  | 'messages.send'
  | 'messages.attachments'
  | 'missed_feeds.items_require_site';

export interface Capability {
  enabled: boolean;
  verification: 'verified' | 'conflict' | 'unverified';
  note: string;
}

export const DEFAULT_CAPABILITIES: Record<CapabilityKey, Capability> = {
  'claims.write_messages': {
    enabled: false,
    verification: 'unverified',
    note: 'Current write contract for /post-purchase/v1/claims/{id}/messages not confirmed.',
  },
  'claims.execute_action': {
    enabled: false,
    verification: 'unverified',
    note: 'Only enable per flow after available_actions contract test passes.',
  },
  'returns.attachments': {
    enabled: false,
    verification: 'unverified',
    note: 'New architecture references return_id; requires explicit enablement.',
  },
  'questions.answer': {
    enabled: false,
    verification: 'unverified',
    note: 'POST /answers reserved for a future playbook; max 2000 chars.',
  },
  'items.pause': {
    enabled: false,
    verification: 'unverified',
    note: 'PUT /items/{id} status=paused. Human approved only.',
  },
  'stock.user_product_update': {
    enabled: false,
    verification: 'unverified',
    note: 'Per site/type; x-version is mandatory and 409 forces a refetch.',
  },
  'messages.send': {
    enabled: false,
    verification: 'unverified',
    note: 'Requires action_guide + caps_available check immediately before sending.',
  },
  'messages.attachments': {
    enabled: false,
    verification: 'unverified',
    note: 'Max 25 MB, JPG/PNG/PDF/TXT, associate within 48h.',
  },
  'missed_feeds.items_require_site': {
    enabled: false,
    verification: 'unverified',
    note: 'items topic may require site_id in /missed_feeds.',
  },
};

export function isCapabilityEnabled(
  capabilities: Partial<Record<CapabilityKey, Capability>>,
  key: CapabilityKey,
): boolean {
  return (capabilities[key] ?? DEFAULT_CAPABILITIES[key]).enabled;
}
