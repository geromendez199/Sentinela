import { clamp01, ramp, rateZ } from './normalization';

/** Feature schema version. Bump with any change to names or semantics. */
export const FEATURE_SCHEMA_VERSION = 'fs-0.1.0';

export interface RiskFeatureInput {
  /** Minutes until expected_dispatch_at; negative when already past. */
  slaMinutesRemaining: number | null;
  slaStatus: string | null;
  shipmentSubstatus: string | null;
  hasDelaySignal: boolean;
  logisticType: string | null;
  packOrderCount: number;
  skuClaimRate60d: number | null;
  itemClaimRate60d: number | null;
  categoryClaimRate60d: number | null;
  publishedStock: number | null;
  operationalStock: number | null;
  stockStaleMinutes: number | null;
  buyerWhereIsPackage: boolean;
  buyerProductIssue: boolean;
  urgency: number | null;
  sentiment: number | null;
  sellerResponseMinutes: number | null;
  /** Pending orders divided by historical hourly dispatch capacity. */
  pendingOrders: number;
  hourlyCapacity: number | null;
  /** 0 = far from the threshold, 1 = at it. From the reputation computation. */
  accountHeadroomRatio: number | null;
}

export type FeatureVector = Record<string, number>;

const EXCEPTION_SUBSTATUS = new Set([
  'delayed',
  'delivery_failed',
  'returning_to_sender',
  'lost',
  'damaged',
  'stale',
  'not_delivered',
  'shipment_stopped',
  'waiting_for_withdrawal',
]);

/**
 * Builds the normalized feature vector.
 *
 * Leakage rule (section 8.1): an already open claim on this order is never a
 * feature for predicting claim opening on the same order. Escalation is a
 * separate model with a separate inference moment.
 */
export function buildFeatures(input: RiskFeatureInput): FeatureVector {
  const slaPressure =
    input.slaMinutesRemaining === null
      ? input.slaStatus === 'delayed'
        ? 1
        : 0.3
      : // 1 when overdue, 0 when more than 24h remain.
        ramp(input.slaMinutesRemaining, 1440, -120);

  const shipmentException =
    (input.shipmentSubstatus && EXCEPTION_SUBSTATUS.has(input.shipmentSubstatus.toLowerCase()) ? 0.7 : 0) +
    (input.hasDelaySignal ? 0.3 : 0);

  const stockGap =
    input.publishedStock === null || input.operationalStock === null
      ? // Unknown operational stock is itself a mild risk signal.
        input.stockStaleMinutes === null
        ? 0.2
        : ramp(input.stockStaleMinutes, 60, 1440) * 0.6
      : ramp(input.publishedStock - input.operationalStock, 0, Math.max(1, input.publishedStock));

  return {
    sla_pressure: clamp01(slaPressure) * (input.logisticType === 'fulfillment' ? 0.5 : 1),
    shipment_exception: clamp01(shipmentException),
    stock_gap: clamp01(stockGap),
    sku_claim_rate_z: rateZ(input.skuClaimRate60d ?? 0, input.categoryClaimRate60d ?? 0.02, 0.03),
    item_claim_rate_z: rateZ(input.itemClaimRate60d ?? 0, input.categoryClaimRate60d ?? 0.02, 0.03),
    message_package_intent: input.buyerWhereIsPackage ? 1 : 0,
    message_product_issue: input.buyerProductIssue ? 1 : 0,
    urgency: clamp01(input.urgency ?? 0),
    negative_sentiment: clamp01(((input.sentiment ?? 0) * -1 + 1) / 2),
    response_latency: input.sellerResponseMinutes === null ? 0 : ramp(input.sellerResponseMinutes, 30, 720),
    capacity_pressure:
      input.hourlyCapacity && input.hourlyCapacity > 0
        ? ramp(input.pendingOrders / input.hourlyCapacity, 1, 6)
        : 0,
    account_headroom: clamp01(input.accountHeadroomRatio ?? 0),
    // Pack multiplier is not a weighted feature: it scales operational impact,
    // which the queue uses for ordering, not the probability itself.
    pack_order_count: clamp01((input.packOrderCount - 1) / 5),
  };
}
