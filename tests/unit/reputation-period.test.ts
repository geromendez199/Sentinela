import { describe, expect, it } from 'vitest';
import { parseOfficialPeriodDays } from '../../supabase/functions/_shared/reputation-period';

describe('parseOfficialPeriodDays', () => {
  it.each([
    ['60 days', 60],
    ['30 días', 30],
    ['1 day', 1],
    ['3 months', 90],
    ['2 meses', 60],
    ['1 month', 30],
    ['1 year', 365],
    ['2 años', 730],
  ])('parses explicit official period %s', (period, expected) => {
    expect(parseOfficialPeriodDays(period)).toBe(expected);
  });

  it.each([null, undefined, '', '0 days', '3m', '1y', 'P3M', '90', 'about 60 days', '3 months extra']) (
    'rejects ambiguous or malformed period %s',
    (period) => {
      expect(parseOfficialPeriodDays(period)).toBeNull();
    },
  );
});
