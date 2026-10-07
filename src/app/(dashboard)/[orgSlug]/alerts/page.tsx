import Link from 'next/link';
import { AcknowledgeButton } from '@/components/alerts/acknowledge-button';
import { hasPermission } from '@/lib/auth/permissions';
import { ListFilters, Pagination } from '@/components/ui/list-controls';
import { listQuery, PAGE_SIZE, literalSearch, type ListParams } from '@/lib/ui/list-query';
import { prioritySlices } from '@/lib/ui/priority-pagination';
import { statusLabel } from '@/lib/ui/labels';
import { requireOrg } from '@/lib/auth/require-role';
import { createClient } from '@/lib/supabase/server';
import { Card } from '@/components/ui/card';
import { DataTable } from '@/components/ui/data-table';
import { SlaCountdown } from '@/components/support/sla-countdown';
import { formatDateTime } from '@/lib/utils/format';

const SEVERITIES = ['critical', 'high', 'warning', 'info'];
const SEVERITY_STYLES: Record<string, string> = { critical: 'border-black bg-black text-white', high: 'border-neutral-700 bg-neutral-800 text-white', warning: 'border-neutral-300 bg-neutral-100 text-neutral-800', info: 'border-neutral-200 bg-white text-neutral-600' };

export default async function AlertsPage({ params, searchParams }: { params: Promise<{ orgSlug: string }>; searchParams: Promise<ListParams> }) {
  const { orgSlug } = await params;
  const ctx = await requireOrg(orgSlug);
  const supabase = await createClient();
  const statuses = ['open', 'acknowledged', 'resolved', 'suppressed'];
  const sorts = ['priority', 'newest', 'oldest'];
  const filters = listQuery(await searchParams, statuses, sorts);
  const severities = filters.severity ? [filters.severity] : SEVERITIES;
  function filteredQuery(head = false) {
    let query = supabase.from('alerts').select('*', { count: 'exact', head }).eq('org_id', ctx.orgId);
    if (filters.status) query = query.eq('status', filters.status);
    if (filters.q) query = query.ilike('title', '%' + literalSearch(filters.q) + '%');
    if (filters.severity) query = query.eq('severity', filters.severity);
    return query;
  }
  const counts = await Promise.all(severities.map(async (severity) => {
    const { count } = await filteredQuery(true).eq('severity', severity).throwOnError();
    return count ?? 0;
  }));
  const total = counts.reduce((sum, count) => sum + count, 0);
  const offset = (filters.page - 1) * PAGE_SIZE;
  const data = filters.sort === 'priority'
    ? (await Promise.all(prioritySlices(counts, offset, PAGE_SIZE).map(async (slice) => {
        const { data } = await filteredQuery().eq('severity', severities[slice.group] ?? 'info').order('created_at', { ascending: false }).order('id', { ascending: false }).range(slice.from, slice.to).throwOnError();
        return data ?? [];
      }))).flat()
    : (await filteredQuery().order('created_at', { ascending: filters.sort === 'oldest' }).order('id', { ascending: false }).range(offset, offset + PAGE_SIZE - 1).throwOnError()).data ?? [];

  const claimIds = data.filter((row) => row.resource_type === 'claim' && row.resource_id && /^\d+$/.test(row.resource_id)).map((row) => Number(row.resource_id)).filter(Number.isSafeInteger);
  const deadlines = new Map<string, string | null>();
  if (claimIds.length) {
    const { data: claims } = await supabase.from('claims').select('claim_id, due_date, status').eq('org_id', ctx.orgId).in('claim_id', claimIds).throwOnError();
    (claims ?? []).filter((row) => row.status !== 'closed').forEach((row) => deadlines.set(String(row.claim_id), row.due_date));
  }
  const canAcknowledge = hasPermission(ctx.role, 'alerts:ack');
  return <div className="space-y-6">
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">{severities.map((severity, index) => <Link key={severity} href={'?' + new URLSearchParams({ ...Object.fromEntries(Object.entries(filters).filter(([key]) => key !== 'page')), severity })} className="card p-4"><p className="page-eyebrow">{statusLabel(severity)}</p><p className="mt-2 text-3xl font-semibold tracking-tight">{counts[index]}</p><p className="muted mt-1 text-[11px]">En esta vista filtrada</p></Link>)}</div>
    <Card title="Centro de alertas" subtitle="Revisá primero las críticas. Marcar como vista confirma la lectura; la resolución sigue siendo una acción separada.">
      <ListFilters {...filters} sorts={sorts} withSeverity statuses={statuses} placeholder="Título de la alerta" />
      <DataTable selectionScope={orgSlug + ':' + JSON.stringify(filters)} selectableLabel="alertas" bulkAcknowledge={canAcknowledge ? { orgSlug } : undefined} rows={data} rowKey={(row) => row.id}
        empty="No hay alertas para esta vista."
        emptyAction={<Link href={filters.q || filters.status || filters.severity ? '/' + orgSlug + '/alerts' : '/' + orgSlug + '/overview'} className="rounded-lg bg-black px-4 py-2.5 text-xs text-white">{filters.q || filters.status || filters.severity ? 'Ver todas las alertas' : 'Volver al resumen'}</Link>}
        columns={[
          { key: 'severity', header: 'Severidad', exportValue: (row) => statusLabel(row.severity), render: (row) => <span className={'inline-flex rounded-full border px-2.5 py-1 text-[11px] font-semibold ' + SEVERITY_STYLES[row.severity]}>{statusLabel(row.severity)}</span> },
          { key: 'title', header: 'Alerta', exportValue: (row) => row.title, render: (row) => <div className="min-w-44 max-w-md"><p className="font-medium">{row.title}</p><p className="muted mt-1 line-clamp-2 text-xs">{row.body}</p>{row.resource_type === 'order' && row.resource_id && <Link className="mt-2 inline-block text-xs underline" href={'/' + orgSlug + '/orders/' + encodeURIComponent(row.resource_id)}>Ver orden →</Link>}{row.resource_type === 'claim' && row.resource_id && <Link className="mt-2 inline-block text-xs underline" href={'/' + orgSlug + '/claims/' + encodeURIComponent(row.resource_id)}>Ver reclamo →</Link>}</div> },
          { key: 'sla', header: 'Vencimiento', exportValue: (row) => deadlines.get(row.resource_id ?? '') ?? '', render: (row) => deadlines.has(row.resource_id ?? '') ? <SlaCountdown dueAt={deadlines.get(row.resource_id ?? '') ?? null} /> : <span className="muted text-xs">Sin plazo informado</span> },
          { key: 'status', header: 'Estado', render: (row) => statusLabel(row.status) },
          { key: 'ack', header: 'Gestión', render: (row) => row.status === 'open' && canAcknowledge ? <AcknowledgeButton orgSlug={orgSlug} alertId={row.id} /> : '—' },
          { key: 'created', header: 'Recibida', exportValue: (row) => row.created_at, render: (row) => <span className="whitespace-nowrap text-xs">{formatDateTime(row.created_at)}</span> },
        ]} />
      <Pagination {...filters} hasNext={offset + PAGE_SIZE < total} />
    </Card>
  </div>;
}
