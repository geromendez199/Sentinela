export type MetricKey = 'claims' | 'cancellations' | 'delayed_handling_time';
export type Comparator = 'lt' | 'lte';
export type ThresholdBand = 'target' | 'green' | 'yellow' | 'orange' | 'red';
export type Fidelity = 'initializing' | 'calibrated' | 'degraded' | 'unknown';

export interface MetricThresholds {
  target: number;
  green: number;
  yellow: number;
  orange: number;
}

export interface ReputationRuleSet {
  id: string;
  siteId: string;
  version: string;
  highVolumeWindowDays: number | null;
  lowVolumeWindowDays: number;
  highVolumeMinSales: number | null;
  thresholds: Record<MetricKey, MetricThresholds>;
  comparators: Partial<Record<MetricKey, Comparator>>;
  verificationStatus: 'verified' | 'conflict' | 'unverified';
}

export interface OfficialMetric {
  period: string | null;
  rate: number | null;
  value: number | null;
}

export interface OfficialSnapshot {
  observedAt: string;
  levelId: string | null;
  powerSellerStatus: string | null;
  salesCompleted: number | null;
  metrics: Record<MetricKey, OfficialMetric>;
}

export interface MetricHeadroom {
  metric: MetricKey;
  band: ThresholdBand;
  rate: number;
  threshold: number;
  comparator: Comparator;
  /** Incidents tolerated over sales already in the denominator. */
  headroomExisting: number;
  /** Consecutive new incidented sales tolerated (numerator and denominator grow). */
  headroomFutureBadSales: number;
  /** Healthy new sales needed to return under the threshold. */
  healthySalesToRecover: number;
}

export interface TwinDrift {
  metric: MetricKey;
  valueDelta: number;
  rateDelta: number;
  exceedsTolerance: boolean;
}

export interface TwinResult {
  windowDays: number;
  denominator: number;
  values: Record<MetricKey, number>;
  rates: Record<MetricKey, number>;
  headroom: MetricHeadroom[];
  drift: TwinDrift[];
  fidelity: Fidelity;
}
