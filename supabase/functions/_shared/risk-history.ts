const DAY_MS = 86_400_000;

export interface HistoryWindow {
  since: string;
  before: string;
}

/**
 * Builds a historical feature window anchored to the order being scored.
 * The exclusive `before` bound prevents lookahead when old orders are re-scored
 * during backfills or offline evaluation.
 */
export function riskHistoryWindow(asOf: string, days: number): HistoryWindow {
  const asOfMs = Date.parse(asOf);
  if (!Number.isFinite(asOfMs)) throw new Error('invalid_risk_as_of');
  if (!Number.isInteger(days) || days <= 0) throw new Error('invalid_risk_history_days');

  return {
    since: new Date(asOfMs - days * DAY_MS).toISOString(),
    before: new Date(asOfMs).toISOString(),
  };
}
