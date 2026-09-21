import { sigmoid } from './normalization';
import type { FeatureVector } from './feature-builder';

export type RiskBand = 'low' | 'medium' | 'high' | 'critical';

export interface RiskModel {
  id: string;
  name: string;
  version: string;
  intercept: number;
  weights: Record<string, number>;
  thresholds: { low: number; medium: number; high: number };
}

export interface FeatureContribution {
  feature: string;
  value: number;
  weight: number;
  contribution: number;
}

export interface RiskResult {
  score: number;
  band: RiskBand;
  contributions: FeatureContribution[];
  /**
   * Version 0 is explainable, not statistically calibrated. The UI must present
   * a "score de riesgo" with this status, never an empirical probability.
   */
  calibration: 'uncalibrated_heuristic' | 'platt' | 'isotonic';
}

export const DEFAULT_WEIGHTS: Record<string, number> = {
  sla_pressure: 1.8,
  shipment_exception: 1.35,
  stock_gap: 1.55,
  sku_claim_rate_z: 0.9,
  item_claim_rate_z: 0.75,
  message_package_intent: 1.1,
  message_product_issue: 1.55,
  urgency: 0.95,
  negative_sentiment: 0.5,
  response_latency: 0.85,
  capacity_pressure: 1.1,
  account_headroom: 0.7,
};

export function bandFor(score: number, thresholds: RiskModel['thresholds']): RiskBand {
  if (score < thresholds.low) return 'low';
  if (score < thresholds.medium) return 'medium';
  if (score < thresholds.high) return 'high';
  return 'critical';
}

export function scoreWithModel(features: FeatureVector, model: RiskModel): RiskResult {
  const contributions: FeatureContribution[] = [];
  let logit = model.intercept;

  for (const [feature, weight] of Object.entries(model.weights)) {
    const value = features[feature] ?? 0;
    const contribution = weight * value;
    logit += contribution;
    contributions.push({ feature, value, weight, contribution });
  }

  contributions.sort((a, b) => Math.abs(b.contribution) - Math.abs(a.contribution));
  const score = sigmoid(logit);

  return {
    score,
    band: bandFor(score, model.thresholds),
    contributions,
    calibration: 'uncalibrated_heuristic',
  };
}
