import { describe, expect, it } from 'vitest';
import { buildFeatures, type RiskFeatureInput } from '@/lib/risk/feature-builder';
import { DEFAULT_WEIGHTS, scoreWithModel, type RiskModel } from '@/lib/risk/heuristic';
import { inferRisk } from '@/lib/risk/inference';
import { explain } from '@/lib/risk/explanations';

const MODEL: RiskModel = {
  id: 'model-0',
  name: 'baseline-heuristic',
  version: '0.1.0',
  intercept: -3.2,
  weights: DEFAULT_WEIGHTS,
  thresholds: { low: 0.35, medium: 0.6, high: 0.8 },
};

function baseInput(overrides: Partial<RiskFeatureInput> = {}): RiskFeatureInput {
  return {
    slaMinutesRemaining: 2880,
    slaStatus: 'on_time',
    shipmentSubstatus: null,
    hasDelaySignal: false,
    logisticType: 'drop_off',
    packOrderCount: 1,
    skuClaimRate60d: 0,
    itemClaimRate60d: 0,
    categoryClaimRate60d: 0.02,
    publishedStock: 10,
    operationalStock: 10,
    stockStaleMinutes: 5,
    buyerWhereIsPackage: false,
    buyerProductIssue: false,
    urgency: 0,
    sentiment: 0,
    sellerResponseMinutes: null,
    pendingOrders: 0,
    hourlyCapacity: 10,
    accountHeadroomRatio: 0,
    ...overrides,
  };
}

describe('feature normalization', () => {
  it('keeps every feature inside [0,1]', () => {
    const features = buildFeatures(
      baseInput({ slaMinutesRemaining: -5000, packOrderCount: 50, urgency: 5, sentiment: -3 }),
    );
    for (const value of Object.values(features)) {
      expect(value).toBeGreaterThanOrEqual(0);
      expect(value).toBeLessThanOrEqual(1);
    }
  });

  it('raises SLA pressure once the dispatch deadline has passed', () => {
    const onTime = buildFeatures(baseInput({ slaMinutesRemaining: 2880 }));
    const overdue = buildFeatures(baseInput({ slaMinutesRemaining: -60 }));
    expect(overdue.sla_pressure).toBeGreaterThan(onTime.sla_pressure!);
  });

  it('discounts SLA pressure for fulfillment, where the seller does not dispatch', () => {
    const flex = buildFeatures(baseInput({ slaMinutesRemaining: -60, logisticType: 'flex' }));
    const full = buildFeatures(baseInput({ slaMinutesRemaining: -60, logisticType: 'fulfillment' }));
    expect(full.sla_pressure).toBeLessThan(flex.sla_pressure!);
  });
});

describe('heuristic scoring', () => {
  it('produces a low score for a healthy order', () => {
    const result = scoreWithModel(buildFeatures(baseInput()), MODEL);
    expect(result.band).toBe('low');
  });

  it('escalates when the buyer reports a product problem on a late shipment', () => {
    const result = scoreWithModel(
      buildFeatures(
        baseInput({
          slaMinutesRemaining: -240,
          shipmentSubstatus: 'delayed',
          hasDelaySignal: true,
          buyerProductIssue: true,
          urgency: 0.9,
          sentiment: -0.8,
          sellerResponseMinutes: 600,
        }),
      ),
      MODEL,
    );
    expect(result.score).toBeGreaterThan(0.6);
    expect(['high', 'critical']).toContain(result.band);
  });

  it('never reports itself as calibrated', () => {
    const result = scoreWithModel(buildFeatures(baseInput()), MODEL);
    expect(result.calibration).toBe('uncalibrated_heuristic');
  });

  it('stores every contribution so a decision stays auditable', () => {
    const result = inferRisk(baseInput({ buyerProductIssue: true }), MODEL);
    expect(result.contributions.length).toBe(Object.keys(DEFAULT_WEIGHTS).length);
    expect(explain(result.contributions).length).toBeGreaterThan(0);
  });

  it('scores each outcome from the features that can cause it', () => {
    const result = inferRisk(baseInput({ publishedStock: 10, operationalStock: 0 }), MODEL);
    // A stock gap drives cancellation risk, not delay risk.
    expect(result.outcomes.cancellationRisk).toBeGreaterThan(result.outcomes.delayRisk);
  });
});
