import { requireOrg } from '@/lib/auth/require-role';
import { createClient } from '@/lib/supabase/server';
import { Card } from '@/components/ui/card';
import { DataTable } from '@/components/ui/data-table';
import { formatCount, formatDateTime } from '@/lib/utils/format';

export default async function RootCausesPage({ params }: { params: Promise<{ orgSlug: string }> }) {
  const { orgSlug } = await params;
  const ctx = await requireOrg(orgSlug);
  const supabase = await createClient();

  const { data } = await supabase
    .from('root_cause_clusters')
    .select('*')
    .eq('org_id', ctx.orgId)
    .eq('status', 'active')
    .order('sample_count', { ascending: false })
    .limit(50);

  return (
    <Card
      title="Causa raiz"
      subtitle={`Clusters sobre texto sanitizado. Organizacion ${orgSlug}.`}
    >
      <DataTable
        rows={data ?? []}
        rowKey={(row) => row.id}
        empty="Sin clusters todavia."
        columns={[
          { key: 'label', header: 'Patron', render: (row) => row.label },
          { key: 'item', header: 'Publicacion', render: (row) => row.item_id },
          { key: 'size', header: 'Casos', render: (row) => formatCount(row.sample_count) },
          {
            key: 'trend',
            header: 'Tendencia',
            render: (row) => (row.trend_score === null ? '—' : row.trend_score.toFixed(2)),
          },
          { key: 'last', header: 'Ultimo caso', render: (row) => formatDateTime(row.last_seen_at) },
        ]}
      />
    </Card>
  );
}
