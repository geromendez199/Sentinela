import { describe, expect, it } from 'vitest';
import {
  DAY_MS,
  HOUR_MS,
  boundedWindowEnd,
  splitEffectiveWindow,
} from '../../supabase/functions/_shared/backfill-window';

describe('backfill effective windows', () => {
  it('uses the effective clamped 30-minute window instead of the desired 7-day window', () => {
    const rangeEnd = '2026-09-23T12:00:00.000Z';
    const windowStart = '2026-09-23T11:30:00.000Z';
    const windowEnd = boundedWindowEnd(windowStart, rangeEnd, 7 * DAY_MS);

    expect(windowEnd).toBe(rangeEnd);
    expect(splitEffectiveWindow(windowStart, windowEnd)).toEqual({
      effectiveMs: 30 * 60 * 1000,
      nextWindowMs: null,
    });
  });

  it('splits a clamped two-hour window to one hour', () => {
    const windowStart = '2026-09-23T10:00:00.000Z';
    const windowEnd = '2026-09-23T12:00:00.000Z';
    expect(splitEffectiveWindow(windowStart, windowEnd)).toEqual({
      effectiveMs: 2 * HOUR_MS,
      nextWindowMs: HOUR_MS,
    });
  });

  it('halves the effective interval when it is larger than two hours', () => {
    const windowStart = '2026-09-20T00:00:00.000Z';
    const windowEnd = '2026-09-23T00:00:00.000Z';
    expect(splitEffectiveWindow(windowStart, windowEnd)).toEqual({
      effectiveMs: 3 * DAY_MS,
      nextWindowMs: Math.floor((3 * DAY_MS) / 2),
    });
  });
});
