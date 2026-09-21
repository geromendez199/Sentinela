import type { Comparator } from './types';
import { satisfies } from './rule-sets';

/**
 * Two distinct safety margins (section 4.3). Conflating them is the classic
 * error: an incident on a sale already counted moves only the numerator, while
 * a new incidented sale moves numerator and denominator together.
 */

/** Incidents tolerated over sales already in the denominator. */
export function headroomExisting(
  denominator: number,
  value: number,
  threshold: number,
  comparator: Comparator = 'lte',
  max = 100_000,
): number {
  const n = Math.max(denominator, 1);
  for (let k = 0; k < max; k++) {
    const rate = (value + k + 1) / n;
    if (!satisfies(rate, threshold, comparator)) return k;
  }
  return max;
}

/** Consecutive new incidented sales tolerated. */
export function headroomFutureBadSales(
  denominator: number,
  value: number,
  threshold: number,
  comparator: Comparator = 'lte',
  max = 100_000,
): number {
  for (let k = 0; k < max; k++) {
    const nextRate = (value + k + 1) / (denominator + k + 1);
    if (!satisfies(nextRate, threshold, comparator)) return k;
  }
  return max;
}

/** Healthy new sales needed to drop back under the threshold. */
export function healthySalesToRecover(
  denominator: number,
  value: number,
  threshold: number,
  comparator: Comparator = 'lte',
  max = 1_000_000,
): number {
  if (threshold <= 0) return value > 0 ? max : 0;
  for (let k = 0; k <= max; k++) {
    if (satisfies(value / (denominator + k), threshold, comparator)) return k;
  }
  return max;
}
