import Link from 'next/link';
import { requireOrg } from '@/lib/auth/require-role';
import { createClient } from '@/lib/supabase/server';
import { Card } from '@/components/ui/card';
import { DataTable } from '@/components/ui/data-table';
import { formatDateTime } from '@/lib/utils/format';

export default async function ClaimsPage({ params }: { params: Promise<{ orgSlug: string }> }) {
  const { orgSlug } = await params;
  const ctx = await requireOrg(orgSlug);
  const supabase = await createClient();

  const { data } = await supabase
    .from('claims')
    .select('claim_id, order_id, status, stage, type, affects_reputation, due_date, date_created')
    .eq('org_id', ctx.orgId)
    .order('date_created', { ascending: false })
    .limit(100);

  return (
    <Card
      title="Reclamos"
      subtitle="affects-reputation se consulta al endpoint oficial y se reconsulta tras cambios de estado"
    >
      <DataTable
        rows={data ?? []}
        rowKey={(row) => String(row.claim_id)}
        empty="Sin reclamos sincronizados."
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
          { key: 'stage', header: 'Etapa', render: (row) => row.stage ?? '—' },
          { key: 'status', header: 'Estado', render: (row) => row.status ?? '—' },
          {
            key: 'affects',
            header: 'Afecta reputacion',
            render: (row) => row.affects_reputation ?? 'sin consultar',
          },
          { key: 'due', header: 'Vence', render: (row) => formatDateTime(row.due_date) },
        ]}
      />
    </Card>
  );
}
