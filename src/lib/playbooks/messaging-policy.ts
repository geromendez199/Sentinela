import type { MeliActionGuide, MeliMessageCaps } from '@/lib/meli/types/messages';
import { POST_SALE_MESSAGE_MAX_CHARS } from './action-catalog';

/**
 * Messaging policy (rule 15). A free-text draft does not imply the message can
 * be sent: the action guide, the caps and the conversation status decide, and
 * approved text may have to be mapped to an option_id/template_id.
 */
export interface MessagingPolicyInput {
  actionGuide: MeliActionGuide | null;
  caps: MeliMessageCaps | null;
  conversationBlocked: boolean;
  approvedText: string;
}

export type MessagingDecision =
  | { allowed: true; mode: 'free_text'; text: string }
  | { allowed: true; mode: 'option'; optionId: string; templateId: string | null }
  | { allowed: false; reason: string };

function matchOption(guide: MeliActionGuide, text: string) {
  const normalized = text.trim().toLowerCase();
  return (guide.options ?? []).find(
    (option) => option.text && option.text.trim().toLowerCase() === normalized,
  );
}

export function decideMessaging(input: MessagingPolicyInput): MessagingDecision {
  if (input.conversationBlocked) return { allowed: false, reason: 'conversation_blocked' };
  if (!input.actionGuide) return { allowed: false, reason: 'action_guide_unavailable' };
  if (input.actionGuide.blocked === true) return { allowed: false, reason: 'action_guide_blocked' };

  if (input.caps && typeof input.caps.caps_available === 'number' && input.caps.caps_available <= 0) {
    return { allowed: false, reason: 'caps_exhausted' };
  }

  const text = input.approvedText.trim();
  if (text.length === 0) return { allowed: false, reason: 'empty_text' };
  if (text.length > POST_SALE_MESSAGE_MAX_CHARS) {
    return { allowed: false, reason: 'text_too_long' };
  }

  const option = matchOption(input.actionGuide, text);
  if (option?.id) {
    return { allowed: true, mode: 'option', optionId: option.id, templateId: option.template_id ?? null };
  }

  if (input.actionGuide.free_text_enabled === false) {
    return { allowed: false, reason: 'free_text_not_enabled' };
  }

  // Options exist but none matches and free text was not explicitly enabled:
  // the conservative choice is to block rather than send something unapproved.
  if ((input.actionGuide.options ?? []).length > 0 && input.actionGuide.free_text_enabled !== true) {
    return { allowed: false, reason: 'option_required' };
  }

  return { allowed: true, mode: 'free_text', text };
}
