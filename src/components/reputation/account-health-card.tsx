import type { AccountHealthResult } from '@/lib/reputation/account-health';
import { formatRate } from '@/lib/utils/format';

const labels: Array<[keyof Pick<AccountHealthResult, 'odr' | 'lsr' | 'cancellationRate' | 'vtr'>, string]> = [
  ['odr', 'ODR sintético'],
  ['lsr', 'LSR'],
  ['cancellationRate', 'Cancelación vendedor'],
  ['vtr', 'VTR'],
];

export function AccountHealthCard({ health }: { health: AccountHealthResult }) {
  return <section className="card p-5 sm:p-6"><div className="flex flex-wrap items-start justify-between gap-4"><div><h2 className="text-sm font-semibold">Salud de cuenta sintética</h2><p className="muted mt-1 text-xs">AHR predictivo · no reemplaza el nivel oficial de Mercado Libre</p></div><div className="text-right"><p className="text-3xl font-semibold tracking-tight">{health.ahr ?? '—'}<span className="muted text-sm"> / 1000</span></p><p className="muted text-xs">{health.status === 'unknown' ? 'Sin datos suficientes' : health.status}</p></div></div><div className="mt-5 grid gap-3 sm:grid-cols-4">{labels.map(([key, label]) => { const metric = health[key]; return <div key={key} className="rounded-xl border border-neutral-200 bg-neutral-50 p-3"><p className="muted text-xs">{label}</p><p className="mt-1 font-medium">{metric.available && metric.value !== null ? formatRate(metric.value) : 'Sin datos'}</p><p className="muted mt-1 text-[11px]">{metric.available ? `${metric.numerator} / ${metric.denominator}` : 'La fuente aún no lo informa'}</p></div>; })}</div><p className="muted mt-4 text-xs">Margen antes de una mediación adicional: <span className="font-medium text-neutral-900">{health.defectFreeSalesBuffer === null ? 'sin cálculo' : `${health.defectFreeSalesBuffer} ventas`}</span></p></section>;
}
