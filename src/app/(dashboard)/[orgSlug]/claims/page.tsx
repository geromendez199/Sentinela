import { ListFilters, Pagination } from '@/components/ui/list-controls';
import { listQuery, PAGE_SIZE, numericSearch, type ListParams } from '@/lib/ui/list-query';
import Link from 'next/link';
import { requireOrg } from '@/lib/auth/require-role';
import { createClient } from '@/lib/supabase/server';
import { Card } from '@/components/ui/card';
import { DataTable } from '@/components/ui/data-table';
import { formatDateTime } from '@/lib/utils/format';
import { SlaCountdown } from '@/components/support/sla-countdown';
import { statusLabel } from '@/lib/ui/labels';

export default async function ClaimsPage({ params, searchParams }: { params: Promise<{ orgSlug: string }>; searchParams: Promise<ListParams> }) {
  const { orgSlug } = await params;
  const ctx = await requireOrg(orgSlug);
  const supabase = await createClient();
  const statuses = ['opened', 'closed'];
  const sorts = ['deadline', 'newest', 'oldest'];
  const filters = listQuery(await searchParams, statuses, sorts);

  let query = supabase
    .from('claims')
    .select('claim_id, order_id, status, stage, type, affects_reputation, due_date, date_created')
    .eq('org_id', ctx.orgId)
    .order(filters.sort === 'deadline' ? 'due_date' : 'date_created', { ascending: filters.sort !== 'newest', nullsFirst: false })
    .order('claim_id', { ascending: false });
  if (filters.status) query = query.eq('status', filters.status);
  if (filters.q) query = query.eq('claim_id', numericSearch(filters.q));
  const { data } = await query.range((filters.page - 1) * PAGE_SIZE, filters.page * PAGE_SIZE).throwOnError();

  return (
    <Card
      title="Reclamos"
      subtitle="El estado y el impacto en reputación informados por Mercado Libre."
    >
      <ListFilters {...filters} sorts={sorts} statuses={statuses} placeholder="Número de reclamo" />
      <DataTable
        selectableLabel="reclamos"
        rows={(data ?? []).slice(0, PAGE_SIZE)}
        rowKey={(row) => String(row.claim_id)}
        empty="Sin reclamos sincronizados."
        emptyAction={<Link href={filters.q || filters.status ? `/${orgSlug}/claims` : `/${orgSlug}/accounts`} className="rounded-lg bg-black px-4 py-2.5 text-xs text-white">{filters.q || filters.status ? 'Limpiar filtros' : 'Revisar sincronización'}</Link>}
        columns={[
          {
            key: 'claim',
            header: 'Reclamo',
            render: (row) => (
              <Link className="underline" href={`/${orgSlug}/claims/${row.claim_id}`}>
                {row.claim_id}
              </Link>
            ),
          },
          { key: 'order', header: 'Orden', render: (row) => row.order_id ?? '—' },
          { key: 'stage', header: 'Etapa', render: (row) => statusLabel(row.stage) },
          { key: 'status', header: 'Estado', render: (row) => statusLabel(row.status) },
          {
            key: 'affects',
            header: 'Afecta reputacion',
            render: (row) => row.affects_reputation === null ? 'Sin consultar' : row.affects_reputation ? 'Sí' : 'No',
          },
          { key: 'due', header: 'Vencimiento / SLA', exportValue: (row) => row.due_date ?? '', render: (row) => <div className="min-w-36"><p className="text-xs">{formatDateTime(row.due_date)}</p>{row.status !== 'closed' && <SlaCountdown dueAt={row.due_date} />}</div> },
        ]}
      />
    <Pagination {...filters} hasNext={(data?.length ?? 0) > PAGE_SIZE} />
    </Card>
  );
}
