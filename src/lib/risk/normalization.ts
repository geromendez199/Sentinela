/** Feature normalization helpers. Every model feature ends up in [0,1]. */

export function clamp01(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.min(1, Math.max(0, value));
}

/** Linear ramp: 0 at `from`, 1 at `to`. Works for both directions. */
export function ramp(value: number, from: number, to: number): number {
  if (from === to) return value >= to ? 1 : 0;
  return clamp01((value - from) / (to - from));
}

/** Robust z-score squashed to [0,1] around a baseline rate. */
export function rateZ(rate: number, baseline: number, spread: number): number {
  if (spread <= 0) return rate > baseline ? 1 : 0;
  return clamp01(0.5 + (rate - baseline) / (2 * spread));
}

export function sigmoid(logit: number): number {
  return 1 / (1 + Math.exp(-logit));
}
