import { classNames } from '@/lib/utils/format';

const BAND_STYLES: Record<string, string> = {
  low: 'bg-emerald-100 text-emerald-800',
  medium: 'bg-amber-100 text-amber-900',
  high: 'bg-orange-100 text-orange-900',
  critical: 'bg-red-100 text-red-800',
};

/** Always "score de riesgo", never a calibrated probability (section 8.1). */
export function RiskScoreBadge({ score, band }: { score: number; band: string }) {
  return (
    <span
      title="Score de riesgo heuristico, no calibrado estadisticamente."
      className={classNames('inline-block rounded px-2 py-0.5 text-xs font-semibold', BAND_STYLES[band] ?? '')}
    >
      {band} · {(score * 100).toFixed(0)}
    </span>
  );
}
