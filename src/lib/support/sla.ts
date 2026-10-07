export type SlaState = 'overdue' | 'urgent' | 'watch' | 'healthy' | 'unknown';

export interface SlaStatus {
  state: SlaState;
  remainingMs: number | null;
  progress: number | null;
  label: string;
}

/** Converts an official due date into an operator-safe urgency state. */
export function getSlaStatus(dueAt: string | null | undefined, now = new Date(), windowMs = 24 * 60 * 60 * 1000): SlaStatus {
  if (!dueAt) return { state: 'unknown', remainingMs: null, progress: null, label: 'SLA no informado' };
  const dueMs = Date.parse(dueAt);
  if (!Number.isFinite(dueMs)) return { state: 'unknown', remainingMs: null, progress: null, label: 'SLA no válido' };
  const remainingMs = dueMs - now.getTime();
  if (remainingMs <= 0) return { state: 'overdue', remainingMs, progress: 0, label: 'Vencido' };
  const progress = Math.max(0, Math.min(1, remainingMs / windowMs));
  const state = remainingMs <= 2 * 60 * 60 * 1000 ? 'urgent' : remainingMs <= 8 * 60 * 60 * 1000 ? 'watch' : 'healthy';
  const hours = Math.floor(remainingMs / 3_600_000);
  const minutes = Math.floor((remainingMs % 3_600_000) / 60_000);
  return { state, remainingMs, progress, label: hours > 0 ? `${hours}h ${minutes}m restantes` : `${Math.max(1, minutes)}m restantes` };
}
