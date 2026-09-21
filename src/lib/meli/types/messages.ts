export interface MeliMessage {
  id: string;
  site_id?: string;
  client_id?: number;
  from?: { user_id?: string | number; role?: string; name?: string };
  to?: { user_id?: string | number; role?: string };
  status?: string;
  text?: string;
  message_date?: { received?: string; available?: string; notified?: string; created?: string; read?: string | null };
  message_moderation?: { status?: string; reason?: string };
  message_attachments?: Array<{ filename?: string; original_filename?: string; size?: number }> | null;
  conversation_first_message?: boolean;
}

export interface MeliMessagesResponse {
  paging?: { total?: number; offset?: number; limit?: number };
  conversation_status?: {
    path?: string;
    status?: string;
    substatus?: string | null;
    blocked?: boolean;
    status_date?: string;
    status_update_date?: string | null;
    claim_id?: number | string | null;
  };
  messages?: MeliMessage[];
}

/** GET /messages/action_guide/packs/{pack}?tag=post_sale */
export interface MeliActionGuide {
  status?: string;
  options?: Array<{ id?: string; text?: string; template_id?: string; enabled?: boolean }>;
  blocked?: boolean;
  /** Whether a free-text seller message may be sent right now. */
  free_text_enabled?: boolean;
}

export interface MeliMessageCaps {
  caps_available?: number;
  total_caps?: number;
  cap_reset_date?: string | null;
}
