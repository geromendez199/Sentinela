import type { MeliMessagesResponse } from '../types/messages';

export type MessageActorRole = 'buyer' | 'seller' | 'meli_agent' | 'system' | 'unknown';

export interface NormalizedMessage {
  messageId: string;
  actorRole: MessageActorRole;
  text: string;
  createdAt: string | null;
  hasAttachments: boolean;
}

export interface NormalizedConversation {
  status: string | null;
  substatus: string | null;
  blocked: boolean;
  messages: NormalizedMessage[];
}

/**
 * The post-sale architecture can place a MercadoLibre agent in the conversation
 * (section 3.x). A message whose sender is neither the buyer nor the seller is
 * tagged so the risk engine does not read it as buyer sentiment.
 */
function resolveRole(role: string | undefined, sellerId: number, senderId: string | number | undefined): MessageActorRole {
  const normalized = role?.toLowerCase();
  if (normalized === 'buyer' || normalized === 'seller') return normalized;
  if (normalized === 'mediator' || normalized === 'meli' || normalized === 'agent') return 'meli_agent';
  if (senderId !== undefined && Number(senderId) === sellerId) return 'seller';
  if (senderId !== undefined && Number.isFinite(Number(senderId))) return 'buyer';
  return 'unknown';
}

export function normalizeConversation(
  response: MeliMessagesResponse,
  sellerId: number,
): NormalizedConversation {
  return {
    status: response.conversation_status?.status ?? null,
    substatus: response.conversation_status?.substatus ?? null,
    blocked: response.conversation_status?.blocked === true,
    messages: (response.messages ?? []).map((message) => ({
      messageId: message.id,
      actorRole: resolveRole(message.from?.role, sellerId, message.from?.user_id),
      text: message.text ?? '',
      createdAt: message.message_date?.created ?? message.message_date?.received ?? null,
      hasAttachments: Array.isArray(message.message_attachments) && message.message_attachments.length > 0,
    })),
  };
}

/** Minutes the seller has left a buyer message unanswered. Feature: response_latency. */
export function sellerResponseMinutes(conversation: NormalizedConversation, now = Date.now()): number | null {
  const ordered = [...conversation.messages].sort(
    (a, b) => Date.parse(a.createdAt ?? '') - Date.parse(b.createdAt ?? ''),
  );
  let pendingSince: number | null = null;
  for (const message of ordered) {
    const at = Date.parse(message.createdAt ?? '');
    if (!Number.isFinite(at)) continue;
    if (message.actorRole === 'buyer' && pendingSince === null) pendingSince = at;
    if (message.actorRole === 'seller') pendingSince = null;
  }
  if (pendingSince === null) return null;
  return Math.round((now - pendingSince) / 60_000);
}
