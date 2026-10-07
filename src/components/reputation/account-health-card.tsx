import type { AccountHealthResult } from '@/lib/reputation/account-health';
import { formatRate } from '@/lib/utils/format';

const labels: Array<[keyof Pick<AccountHealthResult, 'odr' | 'lsr' | 'cancellationRate' | 'vtr'>, string, string]> = [
  ['odr', 'Ventas con defectos · ODR', 'Reclamos con impacto y mediaciones / ventas'],
  ['lsr', 'Despachos tardíos · LSR', 'Despachos tardíos / órdenes despachadas'],
  ['cancellationRate', 'Cancelaciones del vendedor', 'Cancelaciones atribuidas al vendedor / ventas'],
  ['vtr', 'Seguimiento válido · VTR', 'Escaneos a tiempo / envíos con seguimiento'],
];
const HEALTH_LABELS = { excellent: 'Excelente', healthy: 'Saludable', watch: 'Requiere atención', critical: 'Crítica', unknown: 'Sin datos suficientes' };

export function AccountHealthCard({ health }: { health: AccountHealthResult }) {
  const coverage = labels.filter(([key]) => health[key].available).length;
  return <section className="card p-5 sm:p-6">
    <div className="flex flex-wrap items-start justify-between gap-4">
      <div><h2 className="text-sm font-semibold">Salud de cuenta sintética</h2><p className="muted mt-1 max-w-md text-xs leading-relaxed">Lectura orientativa de los datos disponibles. El nivel oficial de Mercado Libre se muestra por separado.</p></div>
      <div className="text-right"><p className="text-4xl font-semibold tracking-tight">{health.ahr ?? '—'}<span className="muted text-sm"> / 1000</span></p><p className="mt-1 text-xs font-medium">{HEALTH_LABELS[health.status]}</p></div>
    </div>
    {health.ahr !== null && <div className="mt-5"><progress className="h-2 w-full" value={health.ahr} max={1000} aria-label={'Salud sintética: ' + health.ahr + ' de 1000'} /><div className="muted mt-1 flex justify-between text-[11px]"><span>Menor salud</span><span>Mayor salud</span></div></div>}
    <p className="muted mt-3 text-xs">Cobertura: {coverage} de 4 métricas disponibles. Las métricas sin datos quedan fuera del cálculo.</p>
    <div className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">{labels.map(([key, label, description]) => {
      const metric = health[key];
      return <div key={key} className="rounded-xl border bg-neutral-50 p-4"><p className="min-h-8 text-xs font-medium">{label}</p><p className="mt-2 text-2xl font-semibold tracking-tight">{metric.available && metric.value !== null ? formatRate(metric.value) : '—'}</p><p className="muted mt-2 text-[11px] leading-relaxed">{description}</p><p className="muted mt-2 text-[11px]">{metric.available ? metric.numerator + ' / ' + metric.denominator : 'La fuente aún no aporta datos suficientes'}</p></div>;
    })}</div>
    <div className="mt-4 rounded-xl border p-4"><p className="text-xs font-medium">Margen de reclamos sobre las ventas contabilizadas</p><p className="mt-1 text-sm">{health.defectFreeSalesBuffer === null ? 'Disponible al completar el cálculo de reputación.' : health.defectFreeSalesBuffer + ' incidentes adicionales tolerados en el cálculo actual.'}</p><p className="muted mt-1 text-[11px]">Es una estimación; revisá los umbrales y el margen detallado antes de decidir.</p></div>
  </section>;
}
