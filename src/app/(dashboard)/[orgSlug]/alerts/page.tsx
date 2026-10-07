import { AcknowledgeButton } from '@/components/alerts/acknowledge-button';
import { hasPermission } from '@/lib/auth/permissions';
import { ListFilters, Pagination } from '@/components/ui/list-controls';
import { listQuery, PAGE_SIZE, literalSearch, type ListParams } from '@/lib/ui/list-query';
import { requireOrg } from '@/lib/auth/require-role';
import { createClient } from '@/lib/supabase/server';
import { Card } from '@/components/ui/card';
import { DataTable } from '@/components/ui/data-table';
import { formatDateTime } from '@/lib/utils/format';

const SEVERITY_STYLES: Record<string, string> = { critical: 'border-black bg-black text-white', high: 'border-neutral-700 bg-neutral-800 text-white', medium: 'border-neutral-300 bg-neutral-100 text-neutral-800', low: 'border-neutral-200 bg-white text-neutral-600' };

export default async function AlertsPage({ params, searchParams }: { params: Promise<{ orgSlug: string }>; searchParams: Promise<ListParams> }) {
  const { orgSlug } = await params;
  const ctx = await requireOrg(orgSlug);
  const supabase = await createClient();
  const statuses = ['open', 'acknowledged', 'resolved', 'suppressed'];
  const filters = listQuery(await searchParams, statuses);

  let query = supabase
    .from('alerts')
    .select('*')
    .eq('org_id', ctx.orgId)
    .order('created_at', { ascending: false })
    .order('id', { ascending: false });
  if (filters.status) query = query.eq('status', filters.status);
  if (filters.q) query = query.ilike('title', `%${literalSearch(filters.q)}%`);
  const { data } = await query.range((filters.page - 1) * PAGE_SIZE, filters.page * PAGE_SIZE).throwOnError();

  return (
    <Card title="Alertas" subtitle={`Organizacion ${orgSlug}`}>
      <ListFilters {...filters} statuses={statuses} placeholder="Título de la alerta" />
      <DataTable
        rows={(data ?? []).slice(0, PAGE_SIZE)}
        rowKey={(row) => row.id}
        empty="Sin alertas."
        columns={[
          { key: 'severity', header: 'Severidad', render: (row) => <span className={`inline-flex rounded-full border px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wide ${SEVERITY_STYLES[row.severity] ?? SEVERITY_STYLES.low}`}>{row.severity}</span> },
          { key: 'title', header: 'Titulo', render: (row) => row.title },
          { key: 'status', header: 'Estado', render: (row) => row.status },
          { key: 'ack', header: 'Gestión', render: (row) => row.status === 'open' && hasPermission(ctx.role, 'alerts:ack') ? <AcknowledgeButton orgSlug={orgSlug} alertId={row.id} /> : '—' },
          { key: 'created', header: 'Creada', render: (row) => formatDateTime(row.created_at) },
        ]}
      />
    <Pagination {...filters} hasNext={(data?.length ?? 0) > PAGE_SIZE} />
    </Card>
  );
}
