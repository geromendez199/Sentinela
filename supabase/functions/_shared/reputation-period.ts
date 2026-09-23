const PERIOD_RE = /^(\d+)\s*(d|day|days|dia|dias|día|días|month|months|mes|meses|year|years|ano|anos|año|años)$/u;

/**
 * Converts an explicit MercadoLibre reputation metric period to days.
 *
 * We accept only unambiguous, unit-bearing forms. This is not a local window
 * inference: the quantity and unit come from the official metrics.*.period.
 * Month/year conversion is solely a common day representation for timestamp
 * filtering; ambiguous abbreviations such as "m" remain rejected.
 */
export function parseOfficialPeriodDays(period: string | null | undefined): number | null {
  if (!period) return null;
  const match = PERIOD_RE.exec(period.trim().toLowerCase());
  if (!match?.[1] || !match[2]) return null;

  const quantity = Number(match[1]);
  if (!Number.isSafeInteger(quantity) || quantity <= 0) return null;

  const unit = match[2];
  if (['d', 'day', 'days', 'dia', 'dias', 'día', 'días'].includes(unit)) return quantity;
  if (['month', 'months', 'mes', 'meses'].includes(unit)) return quantity * 30;
  if (['year', 'years', 'ano', 'anos', 'año', 'años'].includes(unit)) return quantity * 365;
  return null;
}
