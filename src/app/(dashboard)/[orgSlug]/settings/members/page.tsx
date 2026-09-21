import { requirePermission } from '@/lib/auth/require-role';
import { createClient } from '@/lib/supabase/server';
import { Card } from '@/components/ui/card';
import { DataTable } from '@/components/ui/data-table';
import { formatDateTime } from '@/lib/utils/format';

export default async function MembersPage({ params }: { params: Promise<{ orgSlug: string }> }) {
  const { orgSlug } = await params;
  const ctx = await requirePermission(orgSlug, 'members:manage');
  const supabase = await createClient();

  const { data } = await supabase
    .from('organization_members')
    .select('user_id, role, created_at')
    .eq('org_id', ctx.orgId)
    .order('created_at', { ascending: true });

  return (
    <Card
      title="Miembros"
      subtitle="La gestion pasa por un RPC auditado que impide degradar o remover al ultimo owner."
    >
      <DataTable
        rows={data ?? []}
        rowKey={(row) => row.user_id}
        empty="Sin miembros."
        columns={[
          { key: 'user', header: 'Usuario', render: (row) => row.user_id },
          { key: 'role', header: 'Rol', render: (row) => row.role },
          { key: 'since', header: 'Desde', render: (row) => formatDateTime(row.created_at) },
        ]}
      />
    </Card>
  );
}
