import { formatRate } from '@/lib/utils/format';
import type { MetricThresholds, ThresholdBand } from '@/lib/reputation/types';

const BAND_COLORS: Record<ThresholdBand, string> = {
  target: 'bg-emerald-600',
  green: 'bg-emerald-500',
  yellow: 'bg-amber-500',
  orange: 'bg-orange-500',
  red: 'bg-red-600',
};

export function ReputationThermometer({
  label,
  rate,
  band,
  thresholds,
  source,
}: {
  label: string;
  rate: number | null;
  band: ThresholdBand;
  thresholds: MetricThresholds;
  source: 'oficial' | 'calculado';
}) {
  const scaleMax = thresholds.orange * 1.5;
  const width = rate === null ? 0 : Math.min(100, (rate / scaleMax) * 100);

  return (
    <div className="space-y-1">
      <div className="flex items-baseline justify-between text-sm">
        <span className="font-medium">{label}</span>
        <span>
          {formatRate(rate)} <span className="muted text-xs">({source})</span>
        </span>
      </div>
      <div className="h-2 w-full rounded-full bg-slate-200">
        <div className={`h-2 rounded-full ${BAND_COLORS[band]}`} style={{ width: `${width}%` }} />
      </div>
      <div className="muted flex justify-between text-[11px]">
        <span>objetivo {formatRate(thresholds.target, 1)}</span>
        <span>verde {formatRate(thresholds.green, 1)}</span>
        <span>amarillo {formatRate(thresholds.yellow, 1)}</span>
        <span>naranja {formatRate(thresholds.orange, 1)}</span>
      </div>
    </div>
  );
}
