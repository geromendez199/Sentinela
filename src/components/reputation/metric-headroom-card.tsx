import type { MetricHeadroom } from '@/lib/reputation/types';
import { formatCount, formatRate } from '@/lib/utils/format';

const METRIC_LABELS: Record<string, string> = {
  claims: 'Reclamos',
  cancellations: 'Cancelaciones',
  delayed_handling_time: 'Demoras de despacho',
};

/**
 * Both safety margins side by side (section 4.3). Showing only one of them is
 * the ambiguity this card exists to remove.
 */
export function MetricHeadroomCard({ headroom }: { headroom: MetricHeadroom }) {
  return (
    <div className="card p-4">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h3 className="text-sm font-semibold">{METRIC_LABELS[headroom.metric] ?? headroom.metric}</h3>
        <span className="muted text-xs">
          umbral {formatRate(headroom.threshold, 1)} ({headroom.comparator === 'lt' ? 'estricto' : 'inclusivo'})
        </span>
      </div>
      <p className="mt-1 text-2xl font-semibold">{formatRate(headroom.rate)}</p>
      {headroom.threshold > 0 && <div className="mt-3"><progress className="h-2 w-full" max={headroom.threshold} value={Math.min(headroom.threshold, headroom.rate)} aria-label={`Tasa de ${METRIC_LABELS[headroom.metric]} respecto al umbral`} /><p className="muted mt-1 text-[11px]">{headroom.rate >= headroom.threshold ? 'En el umbral o por encima: revisá los incidentes.' : 'Por debajo del umbral: preservá el margen.'}</p></div>}
      <dl className="mt-3 space-y-1 text-xs">
        <div className="flex justify-between gap-3">
          <dt className="muted">Incidentes tolerados sobre ventas ya contabilizadas</dt>
          <dd className="font-medium">{formatCount(headroom.headroomExisting)}</dd>
        </div>
        <div className="flex justify-between gap-3">
          <dt className="muted">Ventas nuevas con incidente consecutivas toleradas</dt>
          <dd className="font-medium">{formatCount(headroom.headroomFutureBadSales)}</dd>
        </div>
        <div className="flex justify-between gap-3">
          <dt className="muted">Ventas sanas para volver bajo el umbral</dt>
          <dd className="font-medium">{formatCount(headroom.healthySalesToRecover)}</dd>
        </div>
      </dl>
    </div>
  );
}
