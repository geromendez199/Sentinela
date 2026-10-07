import { Card } from '@/components/ui/card';
import { RefreshButton } from '@/components/ui/refresh-button';
import { syncHealth, progressPercent, JOB_LABELS, RESOURCE_LABELS, type SyncJob } from '@/lib/accounts/sync-health';
import { formatDateTime } from '@/lib/utils/format';
interface Job extends SyncJob { id: string; resource_kind: string | null; processed_count: number; last_error: string | null }
export function SyncPanel({ jobs }: { jobs: Job[] }) {
 const health=syncHealth(jobs);
 return <Card title={health.label} subtitle={health.message}><div className="mb-5"><RefreshButton /></div><ul className="grid gap-3 sm:grid-cols-2">{jobs.map(job => <li key={job.id} className="rounded-xl border p-4"><div className="flex flex-wrap items-center justify-between gap-2"><h3 className="text-sm font-semibold">{RESOURCE_LABELS[job.resource_kind ?? ''] ?? 'Sincronización'}</h3><span className="rounded-full bg-neutral-100 px-2 py-1 text-xs">{JOB_LABELS[job.status] ?? job.status}</span></div><progress className="mt-4 h-2 w-full accent-black" value={progressPercent(job.progress)} max={100} aria-label={`Avance de ${RESOURCE_LABELS[job.resource_kind ?? ''] ?? 'sincronización'}`} /><p className="muted mt-2 text-xs">{progressPercent(job.progress)}% · {job.processed_count} registros procesados</p><p className="muted mt-2 text-[11px]">Último cambio: {formatDateTime(job.updated_at)}</p>{job.last_error && <p className="mt-3 text-xs" role="status">La tarea informó un error. Compartí su identificador con el administrador: <span className="break-all font-mono">{job.id}</span>.</p>}</li>)}</ul></Card>;
}
