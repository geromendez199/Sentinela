import { requirePermission } from '@/lib/auth/require-role';
import { createClient } from '@/lib/supabase/server';
import { Card } from '@/components/ui/card';
import { DataTable } from '@/components/ui/data-table';
import { DEFAULT_RETENTION } from '@/lib/privacy/retention';

export default async function PrivacyPage({ params }: { params: Promise<{ orgSlug: string }> }) {
  const { orgSlug } = await params;
  const ctx = await requirePermission(orgSlug, 'privacy:manage');
  const supabase = await createClient();

  const [policies, requests] = await Promise.all([
    supabase.from('retention_policies').select('*').eq('org_id', ctx.orgId),
    supabase
      .from('data_subject_requests')
      .select('id, request_type, status, received_at, due_at')
      .eq('org_id', ctx.orgId)
      .order('received_at', { ascending: false })
      .limit(20),
  ]);

  const configured = new Map((policies.data ?? []).map((policy) => [policy.entity, policy]));

  return (
    <div className="space-y-6">
      <Card title="Retencion por entidad" subtitle={`Organizacion ${orgSlug}. Un legal hold nunca se purga.`}>
        <DataTable
          rows={DEFAULT_RETENTION}
          rowKey={(row) => row.entity}
          empty="Sin entidades."
          columns={[
            { key: 'entity', header: 'Entidad', render: (row) => row.entity },
            {
              key: 'days',
              header: 'Dias',
              render: (row) => configured.get(row.entity)?.retention_days ?? row.defaultDays,
            },
            {
              key: 'hold',
              header: 'Legal hold',
              render: (row) => (configured.get(row.entity)?.legal_hold ? 'si' : 'no'),
            },
            { key: 'why', header: 'Motivo', render: (row) => row.rationale },
          ]}
        />
      </Card>

      <Card title="Solicitudes de titulares">
        <DataTable
          rows={requests.data ?? []}
          rowKey={(row) => row.id}
          empty="Sin solicitudes."
          columns={[
            { key: 'type', header: 'Tipo', render: (row) => row.request_type },
            { key: 'status', header: 'Estado', render: (row) => row.status },
            { key: 'received', header: 'Recibida', render: (row) => row.received_at },
          ]}
        />
      </Card>
    </div>
  );
}
