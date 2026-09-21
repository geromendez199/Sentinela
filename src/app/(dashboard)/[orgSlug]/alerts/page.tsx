import { requireOrg } from '@/lib/auth/require-role';
import { createClient } from '@/lib/supabase/server';
import { Card } from '@/components/ui/card';
import { DataTable } from '@/components/ui/data-table';
import { formatDateTime } from '@/lib/utils/format';

export default async function AlertsPage({ params }: { params: Promise<{ orgSlug: string }> }) {
  const { orgSlug } = await params;
  const ctx = await requireOrg(orgSlug);
  const supabase = await createClient();

  const { data } = await supabase
    .from('alerts')
    .select('*')
    .eq('org_id', ctx.orgId)
    .order('created_at', { ascending: false })
    .limit(100);

  return (
    <Card title="Alertas" subtitle={`Organizacion ${orgSlug}`}>
      <DataTable
        rows={data ?? []}
        rowKey={(row) => row.id}
        empty="Sin alertas."
        columns={[
          { key: 'severity', header: 'Severidad', render: (row) => row.severity },
          { key: 'title', header: 'Titulo', render: (row) => row.title },
          { key: 'status', header: 'Estado', render: (row) => row.status },
          { key: 'created', header: 'Creada', render: (row) => formatDateTime(row.created_at) },
        ]}
      />
    </Card>
  );
}
