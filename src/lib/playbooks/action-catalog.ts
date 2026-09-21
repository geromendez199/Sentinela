/** MVP action catalog (section 8.4). */
export type ActionType =
  | 'PRIORITIZE_DISPATCH'
  | 'DRAFT_POST_SALE_MESSAGE'
  | 'SEND_POST_SALE_MESSAGE'
  | 'PAUSE_ITEM'
  | 'UPDATE_STOCK'
  | 'DRAFT_CLAIM_RESPONSE'
  | 'EXECUTE_CLAIM_ACTION'
  | 'SEND_ALERT';

export interface ActionDefinition {
  type: ActionType;
  kind: 'internal' | 'internal_draft' | 'meli_write' | 'outbound_notification';
  /** True when a human must approve before anything leaves the system. */
  requiresHumanApproval: boolean;
  /** Policy that must be re-checked immediately before execution. */
  policyChecks: string[];
  description: string;
}

export const ACTION_CATALOG: Record<ActionType, ActionDefinition> = {
  PRIORITIZE_DISPATCH: {
    type: 'PRIORITIZE_DISPATCH',
    kind: 'internal',
    requiresHumanApproval: false,
    policyChecks: [],
    description: 'Reordena la cola operativa interna. No toca MercadoLibre.',
  },
  DRAFT_POST_SALE_MESSAGE: {
    type: 'DRAFT_POST_SALE_MESSAGE',
    kind: 'internal_draft',
    requiresHumanApproval: false,
    policyChecks: [],
    description: 'Genera un borrador sanitizado. Enviarlo requiere aprobacion humana.',
  },
  SEND_POST_SALE_MESSAGE: {
    type: 'SEND_POST_SALE_MESSAGE',
    kind: 'meli_write',
    requiresHumanApproval: true,
    policyChecks: ['messaging.action_guide', 'messaging.caps_available', 'messaging.length'],
    description: 'Envia mensaje posventa por texto libre u option_id segun action guide.',
  },
  PAUSE_ITEM: {
    type: 'PAUSE_ITEM',
    kind: 'meli_write',
    requiresHumanApproval: true,
    policyChecks: ['item.current_status', 'capability.items.pause'],
    description: 'PUT /items/{id} status=paused tras refetch del item.',
  },
  UPDATE_STOCK: {
    type: 'UPDATE_STOCK',
    kind: 'meli_write',
    requiresHumanApproval: true,
    policyChecks: ['stock.x_version', 'capability.stock.user_product_update'],
    description: 'Actualiza stock solo en el modelo soportado por el sitio. Full no se altera.',
  },
  DRAFT_CLAIM_RESPONSE: {
    type: 'DRAFT_CLAIM_RESPONSE',
    kind: 'internal_draft',
    requiresHumanApproval: false,
    policyChecks: [],
    description: 'Arma texto y evidencia estructurada para un reclamo.',
  },
  EXECUTE_CLAIM_ACTION: {
    type: 'EXECUTE_CLAIM_ACTION',
    kind: 'meli_write',
    requiresHumanApproval: true,
    policyChecks: ['claim.available_actions', 'capability.claims.execute_action'],
    description: 'Ejecuta una resolucion habilitada por available_actions del reclamo.',
  },
  SEND_ALERT: {
    type: 'SEND_ALERT',
    kind: 'outbound_notification',
    requiresHumanApproval: false,
    policyChecks: ['alert.throttle'],
    description: 'Notificacion operativa saliente con throttling y dedupe.',
  },
};

export function isMeliWrite(type: ActionType): boolean {
  return ACTION_CATALOG[type].kind === 'meli_write';
}

/** Max length of a post-sale message (section 3.1). */
export const POST_SALE_MESSAGE_MAX_CHARS = 350;
export const ANSWER_MAX_CHARS = 2000;
