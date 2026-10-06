import { classNames } from '@/lib/utils/format';

const BAND_STYLES: Record<string, string> = {
  low: 'border border-neutral-200 bg-neutral-50 text-neutral-600',
  medium: 'border border-neutral-300 bg-neutral-100 text-neutral-700',
  high: 'bg-neutral-700 text-white',
  critical: 'bg-black text-white',
};

/** Always "score de riesgo", never a calibrated probability (section 8.1). */
export function RiskScoreBadge({ score, band }: { score: number; band: string }) {
  return (
    <span
      title="Score de riesgo heuristico, no calibrado estadisticamente."
      className={classNames('inline-block rounded-full px-3 py-1 text-xs font-semibold', BAND_STYLES[band] ?? '')}
    >
      {band} · {(score * 100).toFixed(0)}
    </span>
  );
}
