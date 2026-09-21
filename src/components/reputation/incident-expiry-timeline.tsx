import { formatDateTime } from '@/lib/utils/format';

export interface ExpiryEntry {
  orderId: number | null;
  metric: string;
  expiresAt: string;
  estimated: boolean;
}

export function IncidentExpiryTimeline({ entries }: { entries: ExpiryEntry[] }) {
  if (entries.length === 0) {
    return <p className="muted text-sm">No hay incidentes dentro de la ventana.</p>;
  }

  return (
    <ol className="space-y-2 text-sm">
      {entries.slice(0, 20).map((entry, index) => (
        <li key={`${entry.orderId ?? 'na'}-${entry.metric}-${index}`} className="flex justify-between">
          <span>
            {entry.metric}
            {entry.orderId ? <span className="muted"> · orden {entry.orderId}</span> : null}
          </span>
          <span>
            {formatDateTime(entry.expiresAt)}
            {/* An expiry date that could not be confirmed is labelled, never silently trusted. */}
            {entry.estimated && <span className="muted"> (estimado)</span>}
          </span>
        </li>
      ))}
    </ol>
  );
}
