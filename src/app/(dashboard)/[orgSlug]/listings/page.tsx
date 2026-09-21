import Link from 'next/link';
import { requireOrg } from '@/lib/auth/require-role';
import { createClient } from '@/lib/supabase/server';
import { Card } from '@/components/ui/card';
import { DataTable } from '@/components/ui/data-table';
import { formatCount, formatDateTime } from '@/lib/utils/format';

export default async function ListingsPage({ params }: { params: Promise<{ orgSlug: string }> }) {
  const { orgSlug } = await params;
  const ctx = await requireOrg(orgSlug);
  const supabase = await createClient();

  const { data } = await supabase
    .from('items')
    .select('item_id, title, status, available_quantity, source_last_updated')
    .eq('org_id', ctx.orgId)
    .order('source_last_updated', { ascending: false })
    .limit(100);

  return (
    <Card title="Publicaciones">
      <DataTable
        rows={data ?? []}
        rowKey={(row) => row.item_id}
        empty="Sin publicaciones sincronizadas."
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
          { key: 'status', header: 'Estado', render: (row) => row.status ?? '—' },
          {
            key: 'stock',
            header: 'Stock publicado',
            render: (row) => formatCount(row.available_quantity),
          },
          { key: 'updated', header: 'Actualizada', render: (row) => formatDateTime(row.source_last_updated) },
        ]}
      />
    </Card>
  );
}
