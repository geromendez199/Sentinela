import Link from 'next/link';
import { requireOrg } from '@/lib/auth/require-role';
import { createClient } from '@/lib/supabase/server';
import { Card } from '@/components/ui/card';
import { DataTable } from '@/components/ui/data-table';
import { formatDateTime } from '@/lib/utils/format';

export default async function OrdersPage({ params }: { params: Promise<{ orgSlug: string }> }) {
  const { orgSlug } = await params;
  const ctx = await requireOrg(orgSlug);
  const supabase = await createClient();

  const { data } = await supabase
    .from('orders')
    .select('order_id, status, pack_id, shipment_id, date_created, source_last_updated')
    .eq('org_id', ctx.orgId)
    .order('date_created', { ascending: false })
    .limit(100);

  return (
    <Card title="Ordenes" subtitle="Estado actual sincronizado desde la API oficial">
      <DataTable
        rows={data ?? []}
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
    </Card>
  );
}
