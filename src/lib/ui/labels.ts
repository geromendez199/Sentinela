const LABELS: Record<string, string> = {
  open: 'Abierta', opened: 'Abierto', acknowledged: 'Vista', resolved: 'Resuelta', suppressed: 'Silenciada',
  paid: 'Pagada', confirmed: 'Confirmada', payment_required: 'Pendiente de pago', payment_in_process: 'Pago en proceso', partially_paid: 'Pago parcial', cancelled: 'Cancelada',
  active: 'Activa', paused: 'Pausada', closed: 'Cerrada', under_review: 'En revisión', inactive: 'Inactiva',
  low: 'Bajo', medium: 'Medio', high: 'Alto', critical: 'Crítico', info: 'Informativa', warning: 'Advertencia',
  claim: 'Reclamo', dispute: 'Mediación', recontact: 'Recontacto',
  draft: 'Borrador', pending_approval: 'Pendiente de aprobación', approved: 'Aprobada', queued: 'En cola', executed: 'Ejecutada', blocked: 'Bloqueada', failed: 'Fallida',
  onboarding: 'Preparando conexión', backfilling: 'Cargando historial', degraded: 'Requiere revisión', reconnect_required: 'Necesita reconexión', restricted: 'Restringida', disconnected: 'Desconectada',
};
export const statusLabel = (value: string | null | undefined) => value ? (LABELS[value] ?? value.replaceAll('_', ' ')) : '—';
