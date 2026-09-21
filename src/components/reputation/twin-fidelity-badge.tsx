import type { FidelityStatus } from '@/lib/supabase/database.types';
import { classNames } from '@/lib/utils/format';

const LABELS: Record<FidelityStatus, { text: string; className: string; help: string }> = {
  initializing: {
    text: 'Gemelo inicializando',
    className: 'bg-slate-100 text-slate-700',
    help: 'Todavia no hay snapshot oficial suficiente para comparar.',
  },
  calibrated: {
    text: 'Gemelo calibrado',
    className: 'bg-emerald-100 text-emerald-800',
    help: 'El calculo interno coincide con el snapshot oficial dentro de la tolerancia.',
  },
  degraded: {
    text: 'Gemelo degradado',
    className: 'bg-amber-100 text-amber-900',
    help: 'Drift sostenido contra la cifra oficial. La divergencia se muestra, no se oculta.',
  },
  unknown: {
    text: 'Fidelidad desconocida',
    className: 'bg-slate-100 text-slate-700',
    help: 'El snapshot oficial no expone metricas comparables.',
  },
};

/** Rule 13: the calculated twin is never presented as the official figure. */
export function TwinFidelityBadge({ fidelity }: { fidelity: FidelityStatus }) {
  const entry = LABELS[fidelity];
  return (
    <span
      title={entry.help}
      className={classNames('inline-block rounded-full px-2 py-0.5 text-xs font-medium', entry.className)}
    >
      {entry.text}
    </span>
  );
}
