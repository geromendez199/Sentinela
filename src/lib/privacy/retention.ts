/** Retention defaults per entity (section 14). A legal hold always wins. */
export interface RetentionRule {
  entity: string;
  defaultDays: number;
  rationale: string;
}

export const DEFAULT_RETENTION: RetentionRule[] = [
  { entity: 'webhook_events', defaultDays: 30, rationale: 'Diagnostico de ingreso; el estado vive en las tablas de negocio.' },
  { entity: 'messages', defaultDays: 400, rationale: 'Cubre la ventana reputacional de 365 dias mas margen operativo.' },
  { entity: 'claim_messages', defaultDays: 400, rationale: 'Evidencia de reclamos dentro de la ventana reputacional.' },
  { entity: 'questions', defaultDays: 400, rationale: 'Analisis de causa raiz pre-venta.' },
  { entity: 'ai_classifications', defaultDays: 400, rationale: 'Trazabilidad de features derivadas de texto.' },
  { entity: 'root_cause_documents', defaultDays: 540, rationale: 'Series de causa raiz por publicacion.' },
  { entity: 'risk_scores', defaultDays: 540, rationale: 'Auditoria de decisiones y calibracion posterior.' },
  { entity: 'security_audit_log', defaultDays: 730, rationale: 'Requisito de auditoria de seguridad.' },
  { entity: 'internal_metrics', defaultDays: 180, rationale: 'Telemetria operativa agregada.' },
];

export function effectiveRetentionDays(
  entity: string,
  orgPolicy: { retention_days: number; legal_hold: boolean } | null,
): { days: number; purgeAllowed: boolean } {
  const fallback = DEFAULT_RETENTION.find((rule) => rule.entity === entity)?.defaultDays ?? 365;
  if (!orgPolicy) return { days: fallback, purgeAllowed: true };
  // Never purge under legal hold (section 6.4).
  return { days: orgPolicy.retention_days, purgeAllowed: !orgPolicy.legal_hold };
}

export function cutoffFor(days: number, now = new Date()): Date {
  return new Date(now.getTime() - days * 86_400_000);
}
