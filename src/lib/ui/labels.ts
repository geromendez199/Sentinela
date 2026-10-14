const LABELS: Record<string, string> = {
  open: 'Abierta', opened: 'Abierto', acknowledged: 'Vista', resolved: 'Resuelta', suppressed: 'Silenciada',
  paid: 'Pagada', confirmed: 'Confirmada', payment_required: 'Pendiente de pago', payment_in_process: 'Pago en proceso', partially_paid: 'Pago parcial', cancelled: 'Cancelada',
  active: 'Activa', paused: 'Pausada', closed: 'Cerrada', under_review: 'En revisión', inactive: 'Inactiva',
  low: 'Bajo', medium: 'Medio', high: 'Alto', critical: 'Crítico', info: 'Informativa', warning: 'Advertencia',
  claim: 'Reclamo', dispute: 'Mediación', recontact: 'Recontacto',
  draft: 'Borrador', pending_approval: 'Pendiente de aprobación', approved: 'Aprobada', queued: 'En cola', executed: 'Ejecutada', blocked: 'Bloqueada', failed: 'Fallida',
  onboarding: 'Preparando conexión', backfilling: 'Cargando historial', degraded: 'Requiere revisión', reconnect_required: 'Necesita reconexión', restricted: 'Restringida', disconnected: 'Desconectada',
  UNANSWERED:'Sin responder', ANSWERED:'Respondida', CLOSED:'Cerrada', ready_to_ship:'Lista para despachar', shipped:'Despachado', delivered:'Entregado',
  calibrated:'Calibrada',initializing:'Preparando cálculo',unknown:'Sin confirmar',
};
export const statusLabel = (value: string | null | undefined) => value ? (LABELS[value] ?? value.replaceAll('_', ' ')) : '—';
export function reputationImpactLabel(value:unknown) { return value==='affected'||value===true?'Sí':value==='not_affected'||value===false?'No':value==='not_applies'?'No aplica':'Sin confirmar'; }
const ACTION_LABELS:Record<string,string>={DRAFT_CLAIM_RESPONSE:'Borrador de respuesta al reclamo',DRAFT_POST_SALE_MESSAGE:'Borrador de respuesta al comprador',SEND_POST_SALE_MESSAGE:'Enviar mensaje al comprador',PAUSE_ITEM:'Pausar publicación',UPDATE_STOCK:'Actualizar disponibilidad',EXECUTE_CLAIM_ACTION:'Resolver acción de reclamo',PRIORITIZE_DISPATCH:'Priorizar despacho',SEND_ALERT:'Enviar alerta'};
export const actionLabel=(kind:string)=>ACTION_LABELS[kind]??kind.replaceAll('_',' ');
