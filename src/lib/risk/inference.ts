import { buildFeatures, FEATURE_SCHEMA_VERSION, type RiskFeatureInput } from './feature-builder';
import { scoreWithModel, type RiskModel, type RiskResult } from './heuristic';

export interface OutcomeScores {
  claimRisk: number;
  cancellationRisk: number;
  delayRisk: number;
}

/**
 * Per-outcome scoring. Each outcome reuses the shared vector but only the
 * features that can cause it: a stock gap drives cancellation, not delay.
 */
const OUTCOME_FEATURES: Record<keyof OutcomeScores, string[]> = {
  claimRisk: [
    'sku_claim_rate_z',
    'item_claim_rate_z',
    'message_package_intent',
    'message_product_issue',
    'urgency',
    'negative_sentiment',
    'response_latency',
    'shipment_exception',
    'account_headroom',
  ],
  cancellationRisk: ['stock_gap', 'capacity_pressure', 'sla_pressure', 'account_headroom'],
  delayRisk: ['sla_pressure', 'shipment_exception', 'capacity_pressure', 'pack_order_count'],
};

function restrict(model: RiskModel, features: string[]): RiskModel {
  const weights: Record<string, number> = {};
  for (const feature of features) {
    const weight = model.weights[feature];
    if (weight !== undefined) weights[feature] = weight;
  }
  return { ...model, weights };
}

export interface InferenceResult extends RiskResult {
  featureSchemaVersion: string;
  modelVersionId: string;
  outcomes: OutcomeScores;
  features: Record<string, number>;
}

export function inferRisk(input: RiskFeatureInput, model: RiskModel): InferenceResult {
  const features = buildFeatures(input);
  const overall = scoreWithModel(features, model);

  const outcomes: OutcomeScores = {
    claimRisk: scoreWithModel(features, restrict(model, OUTCOME_FEATURES.claimRisk)).score,
    cancellationRisk: scoreWithModel(features, restrict(model, OUTCOME_FEATURES.cancellationRisk)).score,
    delayRisk: scoreWithModel(features, restrict(model, OUTCOME_FEATURES.delayRisk)).score,
  };

  return {
    ...overall,
    outcomes,
    features,
    featureSchemaVersion: FEATURE_SCHEMA_VERSION,
    modelVersionId: model.id,
  };
}
