import { requirePermission } from '@/lib/auth/require-role';
import { createClient } from '@/lib/supabase/server';
import { Card } from '@/components/ui/card';
import { RetryDeadLetterButton } from '@/components/operations/retry-dead-letter-button';

type DeadLetter = { id: number; source_queue: string; source_message_id: number; failure_class: string; failure_reason: string; created_at: string; resolved_at: string | null };
type QueryData = { data: unknown; count: number | null };
type UntypedQuery = PromiseLike<QueryData> & { select: (...args: unknown[]) => UntypedQuery; eq: (...args: unknown[]) => UntypedQuery; order: (...args: unknown[]) => UntypedQuery; limit: (...args: unknown[]) => UntypedQuery };
type UntypedDb = { from: (table: string) => UntypedQuery };

export default async function OperationsPage({ params }: { params: Promise<{ orgSlug: string }> }) {
  const { orgSlug } = await params;
  const ctx = await requirePermission(orgSlug, 'org:update');
  const supabase = createClient();
  const db = supabase as unknown as UntypedDb;
  const [{ data: deadLetters }, { count: queuedWebhooks }, { count: failedJobs }] = await Promise.all([
    db.from('dead_letter_events').select('id, source_queue, source_message_id, failure_class, failure_reason, created_at, resolved_at').eq('org_id', ctx.orgId).order('created_at', { ascending: false }).limit(25),
    db.from('webhook_events').select('id', { count: 'exact', head: true }).eq('org_id', ctx.orgId).eq('status', 'queued'),
    db.from('sync_jobs').select('id', { count: 'exact', head: true }).eq('org_id', ctx.orgId).eq('status', 'failed'),
  ]) as [{ data: DeadLetter[] | null }, { count: number | null }, { count: number | null }];
  const unresolved = (deadLetters ?? []).filter((entry) => !entry.resolved_at);

  return <div className="space-y-6"><Card title="Operaciones" subtitle="Salud de sincronización, trabajos fallidos y recuperación controlada."><div className="grid gap-3 sm:grid-cols-3"><Metric label="DLQ sin resolver" value={unresolved.length} /><Metric label="Webhooks pendientes" value={queuedWebhooks ?? 0} /><Metric label="Jobs fallidos" value={failedJobs ?? 0} /></div></Card><Card title="Cola de revisión" subtitle="Los mensajes no se descartan. Reencolalos sólo después de revisar el motivo.">{unresolved.length === 0 ? <p className="muted text-sm">No hay mensajes pendientes de revisión.</p> : <div className="overflow-x-auto"><table className="w-full text-left text-sm"><thead className="text-[10px] uppercase tracking-wider text-neutral-500"><tr><th className="px-3 py-3">Cola</th><th className="px-3 py-3">Error</th><th className="px-3 py-3">Fecha</th><th className="px-3 py-3" /></tr></thead><tbody>{unresolved.map((entry) => <tr key={entry.id} className="border-t"><td className="px-3 py-3 font-mono text-xs">{entry.source_queue}</td><td className="max-w-sm px-3 py-3"><p className="font-medium">{entry.failure_class}</p><p className="muted truncate text-xs">{entry.failure_reason}</p></td><td className="muted whitespace-nowrap px-3 py-3 text-xs">{new Date(entry.created_at).toLocaleString('es-AR')}</td><td className="px-3 py-3"><RetryDeadLetterButton orgSlug={orgSlug} id={entry.id} /></td></tr>)}</tbody></table></div>}</Card></div>;
}

function Metric({ label, value }: { label: string; value: number }) { return <div className="rounded-xl border border-neutral-200 bg-neutral-50 p-4"><p className="muted text-xs">{label}</p><p className="mt-2 text-2xl font-semibold tracking-tight">{value}</p></div>; }
