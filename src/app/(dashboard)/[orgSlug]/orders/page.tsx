import { ListFilters, Pagination } from '@/components/ui/list-controls';
import { listQuery, PAGE_SIZE, numericSearch, type ListParams } from '@/lib/ui/list-query';
import Link from 'next/link';
import { requireOrg } from '@/lib/auth/require-role';
import { createClient } from '@/lib/supabase/server';
import { Card } from '@/components/ui/card';
import { DataTable } from '@/components/ui/data-table';
import { formatDateTime } from '@/lib/utils/format';

export default async function OrdersPage({ params, searchParams }: { params: Promise<{ orgSlug: string }>; searchParams: Promise<ListParams> }) {
  const { orgSlug } = await params;
  const ctx = await requireOrg(orgSlug);
  const supabase = await createClient();
  const statuses = ['paid', 'confirmed', 'payment_required', 'payment_in_process', 'partially_paid', 'cancelled'];
  const filters = listQuery(await searchParams, statuses);

  let query = supabase
    .from('orders')
    .select('order_id, status, pack_id, shipment_id, date_created, source_last_updated')
    .eq('org_id', ctx.orgId)
    .order('date_created', { ascending: false })
    .order('order_id', { ascending: false });
  if (filters.status) query = query.eq('status', filters.status);
  if (filters.q) query = query.eq('order_id', numericSearch(filters.q));
  const { data } = await query.range((filters.page - 1) * PAGE_SIZE, filters.page * PAGE_SIZE).throwOnError();

  return (
    <Card title="Ordenes" subtitle="Estado actual sincronizado desde la API oficial">
      <ListFilters {...filters} statuses={statuses} placeholder="Número de orden" />
      <DataTable
        rows={(data ?? []).slice(0, PAGE_SIZE)}
        rowKey={(row) => String(row.order_id)}
        empty="Sin ordenes sincronizadas."
        columns={[
          {
            key: 'order',
            header: 'Orden',
            render: (row) => (
              <Link className="underline" href={`/${orgSlug}/orders/${row.order_id}`}>
                {row.order_id}
              </Link>
            ),
          },
          { key: 'status', header: 'Estado', render: (row) => row.status },
          { key: 'pack', header: 'Pack', render: (row) => row.pack_id ?? '—' },
          { key: 'shipment', header: 'Envio', render: (row) => row.shipment_id ?? '—' },
          { key: 'created', header: 'Creada', render: (row) => formatDateTime(row.date_created) },
        ]}
      />
    <Pagination {...filters} hasNext={(data?.length ?? 0) > PAGE_SIZE} />
    </Card>
  );
}
