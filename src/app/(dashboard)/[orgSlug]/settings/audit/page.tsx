import { requirePermission } from '@/lib/auth/require-role';
import { createClient } from '@/lib/supabase/server';
import { Card } from '@/components/ui/card';
import { DataTable } from '@/components/ui/data-table';
import { formatDateTime } from '@/lib/utils/format';

export default async function AuditPage({ params }: { params: Promise<{ orgSlug: string }> }) {
  const { orgSlug } = await params;
  const ctx = await requirePermission(orgSlug, 'audit:read');
  const supabase = await createClient();

  const { data } = await supabase
    .from('security_audit_log')
    .select('id, action, resource_type, resource_id, actor_user_id, correlation_id, created_at')
    .eq('org_id', ctx.orgId)
    .order('created_at', { ascending: false })
    .limit(100);

  return (
    <Card title="Auditoria" subtitle={`Organizacion ${orgSlug}. Nunca contiene tokens ni secretos.`}>
      <DataTable
        rows={data ?? []}
        rowKey={(row) => String(row.id)}
        empty="Sin eventos."
        columns={[
          { key: 'action', header: 'Accion', render: (row) => row.action },
          {
            key: 'resource',
            header: 'Recurso',
            render: (row) => `${row.resource_type ?? '—'} ${row.resource_id ?? ''}`.trim(),
          },
          { key: 'actor', header: 'Actor', render: (row) => row.actor_user_id ?? 'sistema' },
          { key: 'when', header: 'Fecha', render: (row) => formatDateTime(row.created_at) },
        ]}
      />
    </Card>
  );
}
