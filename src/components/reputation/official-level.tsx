const LEVELS = ['1_red', '2_orange', '3_yellow', '4_light_green', '5_green'];
const LABELS: Record<string, string> = { '1_red': 'Rojo', '2_orange': 'Naranja', '3_yellow': 'Amarillo', '4_light_green': 'Verde claro', '5_green': 'Verde' };

export function OfficialLevel({ level }: { level: string | null }) {
  const index = level ? LEVELS.indexOf(level) : -1;
  return <span className="inline-flex flex-wrap items-center gap-3"><span title={level ?? undefined} className="text-sm font-semibold">{level ? LABELS[level] ?? level : 'Sin nivel informado'}</span>{index >= 0 && <span className="inline-flex gap-1" aria-hidden="true">{LEVELS.map((value, position) => <span key={value} className={'h-2 w-4 rounded-sm ' + (position <= index ? 'bg-neutral-900' : 'bg-neutral-200')} />)}</span>}</span>;
}
