import type { Explanation } from '@/lib/risk/explanations';

export function FeatureContributions({ explanations }: { explanations: Explanation[] }) {
  if (explanations.length === 0) {
    return <p className="muted text-sm">Sin contribuciones registradas.</p>;
  }

  const max = Math.max(...explanations.map((entry) => Math.abs(entry.contribution)));

  return (
    <ul className="space-y-2">
      {explanations.map((entry) => (
        <li key={entry.feature}>
          <div className="flex justify-between text-xs">
            <span>{entry.label}</span>
            <span className="muted">{entry.contribution.toFixed(2)}</span>
          </div>
          <div className="mt-1 h-1.5 w-full rounded-full bg-slate-200">
            <div
              className={entry.direction === 'increases' ? 'h-1.5 rounded-full bg-black' : 'h-1.5 rounded-full bg-neutral-400'}
              style={{ width: `${(Math.abs(entry.contribution) / Math.max(max, 0.0001)) * 100}%` }}
            />
          </div>
        </li>
      ))}
    </ul>
  );
}
