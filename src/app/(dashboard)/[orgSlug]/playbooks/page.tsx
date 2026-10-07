import { requireOrg } from '@/lib/auth/require-role';
import { createClient } from '@/lib/supabase/server';
import { Card } from '@/components/ui/card';
import { DataTable } from '@/components/ui/data-table';
import { ACTION_CATALOG } from '@/lib/playbooks/action-catalog';

export default async function PlaybooksPage({ params }: { params: Promise<{ orgSlug: string }> }) {
  const { orgSlug } = await params;
  const ctx = await requireOrg(orgSlug);
  const supabase = await createClient();

  const { data } = await supabase
    .from('playbook_rules')
    .select('id, name, enabled, trigger_kind, priority, requires_approval')
    .eq('org_id', ctx.orgId)
    .order('priority', { ascending: false }).throwOnError();

  return (
    <div className="space-y-6">
      <Card title="Reglas" subtitle={`Organizacion ${orgSlug}`}>
        <DataTable
          rows={data ?? []}
          rowKey={(row) => row.id}
          empty="Sin reglas configuradas."
          columns={[
            { key: 'name', header: 'Regla', render: (row) => row.name },
            { key: 'trigger', header: 'Disparador', render: (row) => row.trigger_kind },
            { key: 'priority', header: 'Prioridad', render: (row) => row.priority },
            { key: 'enabled', header: 'Activa', render: (row) => (row.enabled ? 'si' : 'no') },
            {
              key: 'approval',
              header: 'Aprobacion',
              render: (row) => (row.requires_approval ? 'humana' : 'automatica'),
            },
          ]}
        />
      </Card>

      <Card title="Catalogo de acciones del MVP">
        <ul className="space-y-2 text-sm">
          {Object.values(ACTION_CATALOG).map((action) => (
            <li key={action.type} className="flex flex-wrap justify-between gap-2">
              <span className="font-medium">{action.type}</span>
              <span className="muted">
                {action.kind} · {action.requiresHumanApproval ? 'humano obligatorio' : 'automatico'}
              </span>
              <span className="muted w-full text-xs">{action.description}</span>
            </li>
          ))}
        </ul>
      </Card>
    </div>
  );
}
