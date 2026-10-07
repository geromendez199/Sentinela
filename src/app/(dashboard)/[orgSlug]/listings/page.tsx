import { ListFilters, Pagination } from '@/components/ui/list-controls';
import { listQuery, PAGE_SIZE, literalSearch, type ListParams } from '@/lib/ui/list-query';
import Link from 'next/link';
import { requireOrg } from '@/lib/auth/require-role';
import { createClient } from '@/lib/supabase/server';
import { Card } from '@/components/ui/card';
import { DataTable } from '@/components/ui/data-table';
import { formatCount, formatDateTime } from '@/lib/utils/format';
import { statusLabel } from '@/lib/ui/labels';

export default async function ListingsPage({ params, searchParams }: { params: Promise<{ orgSlug: string }>; searchParams: Promise<ListParams> }) {
  const { orgSlug } = await params;
  const ctx = await requireOrg(orgSlug);
  const supabase = await createClient();
  const statuses = ['active', 'paused', 'closed', 'under_review', 'inactive'];
  const filters = listQuery(await searchParams, statuses);

  let query = supabase
    .from('items')
    .select('item_id, title, status, available_quantity, source_last_updated')
    .eq('org_id', ctx.orgId)
    .order('source_last_updated', { ascending: filters.sort === 'oldest' })
    .order('item_id', { ascending: false });
  if (filters.status) query = query.eq('status', filters.status);
  if (filters.q) query = query.ilike('title', `%${literalSearch(filters.q)}%`);
  const { data } = await query.range((filters.page - 1) * PAGE_SIZE, filters.page * PAGE_SIZE).throwOnError();

  return (
    <Card title="Publicaciones">
      <ListFilters {...filters} statuses={statuses} placeholder="Título de la publicación" />
      <DataTable
        selectableLabel="publicaciones"
        rows={(data ?? []).slice(0, PAGE_SIZE)}
        rowKey={(row) => row.item_id}
        empty="Sin publicaciones sincronizadas."
        emptyAction={<Link href={filters.q || filters.status ? `/${orgSlug}/listings` : `/${orgSlug}/accounts`} className="rounded-lg bg-black px-4 py-2.5 text-xs text-white">{filters.q || filters.status ? 'Limpiar filtros' : 'Revisar sincronización'}</Link>}
        columns={[
          {
            key: 'item',
            header: 'Publicacion',
            render: (row) => (
              <Link className="underline" href={`/${orgSlug}/listings/${row.item_id}`}>
                {row.title ?? row.item_id}
              </Link>
            ),
          },
          { key: 'status', header: 'Estado', render: (row) => statusLabel(row.status) },
          {
            key: 'stock',
            exportValue: (row) => row.available_quantity ?? '',
            header: 'Stock publicado',
            render: (row) => row.available_quantity === null ? '—' : formatCount(row.available_quantity),
          },
          { key: 'updated', header: 'Actualizada', exportValue: (row) => row.source_last_updated ?? '', render: (row) => formatDateTime(row.source_last_updated) },
        ]}
      />
    <Pagination {...filters} hasNext={(data?.length ?? 0) > PAGE_SIZE} />
    </Card>
  );
}
