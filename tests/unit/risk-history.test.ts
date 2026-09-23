import { describe, expect, it } from 'vitest';
import { riskHistoryWindow } from '../../supabase/functions/_shared/risk-history';

describe('riskHistoryWindow', () => {
  it('anchors history to the order date instead of wall-clock now', () => {
    expect(riskHistoryWindow('2026-01-31T12:00:00.000Z', 60)).toEqual({
      since: '2025-12-02T12:00:00.000Z',
      before: '2026-01-31T12:00:00.000Z',
    });
  });

  it('uses an exclusive before boundary supplied by the order being scored', () => {
    const window = riskHistoryWindow('2025-06-15T10:30:00.000Z', 60);
    expect(Date.parse(window.since)).toBeLessThan(Date.parse(window.before));
    expect(window.before).toBe('2025-06-15T10:30:00.000Z');
  });

  it('rejects invalid dates and history lengths', () => {
    expect(() => riskHistoryWindow('not-a-date', 60)).toThrow('invalid_risk_as_of');
    expect(() => riskHistoryWindow('2026-01-01T00:00:00.000Z', 0)).toThrow('invalid_risk_history_days');
  });
});
