export const HOUR_MS = 60 * 60 * 1000;
export const DAY_MS = 24 * HOUR_MS;

export function boundedWindowEnd(start: string, rangeEnd: string, windowMs: number): string {
  return new Date(Math.min(Date.parse(start) + windowMs, Date.parse(rangeEnd))).toISOString();
}

export function effectiveWindowMs(windowStart: string, windowEnd: string): number {
  return Math.max(0, Date.parse(windowEnd) - Date.parse(windowStart));
}

export function splitWindow(windowMs: number): number {
  return Math.max(HOUR_MS, Math.floor(windowMs / 2));
}

/**
 * Returns the next requested window after an upstream pagination overflow.
 * The split is based on the interval actually queried after range_end clamping,
 * not the stale desired window size stored in the cursor.
 */
export function splitEffectiveWindow(
  windowStart: string,
  windowEnd: string,
): { effectiveMs: number; nextWindowMs: number | null } {
  const effectiveMs = effectiveWindowMs(windowStart, windowEnd);
  return {
    effectiveMs,
    nextWindowMs: effectiveMs <= HOUR_MS ? null : splitWindow(effectiveMs),
  };
}
