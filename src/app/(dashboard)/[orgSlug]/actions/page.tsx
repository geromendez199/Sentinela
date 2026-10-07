import { requireOrg } from '@/lib/auth/require-role';
import { hasPermission } from '@/lib/auth/permissions';
import { createClient } from '@/lib/supabase/server';
import { Card, EmptyState } from '@/components/ui/card';
import { ActionApprovalPanel } from '@/components/actions/action-approval-panel';

export default async function ActionsPage({ params }: { params: Promise<{ orgSlug: string }> }) {
  const { orgSlug } = await params;
  const ctx = await requireOrg(orgSlug);
  const supabase = await createClient();

  const { data } = await supabase
    .from('action_drafts')
    .select('id, kind, status, rendered_text, requires_approval, created_at, error_code')
    .eq('org_id', ctx.orgId)
    .order('created_at', { ascending: false })
    .limit(50).throwOnError();

  const canApprove = hasPermission(ctx.role, 'actions:approve');

  return (
    <Card
      title="Acciones"
      subtitle="MVP: toda escritura a MercadoLibre requiere aprobacion humana y un chequeo de politica justo antes del write."
    >
      {(data ?? []).length === 0 ? (
        <EmptyState message="Sin acciones registradas." />
      ) : (
        <ul className="space-y-3">
          {(data ?? []).map((action) =>
            canApprove ? (
              <li key={action.id}>
                <ActionApprovalPanel orgSlug={orgSlug} action={action} />
              </li>
            ) : (
              <li key={action.id} className="card p-3 text-sm">
                <div className="flex justify-between">
                  <span className="font-medium">{action.kind}</span>
                  <span className="muted">{action.status}</span>
                </div>
                {action.error_code && <p className="mt-1 text-xs text-red-600">{action.error_code}</p>}
              </li>
            ),
          )}
        </ul>
      )}
    </Card>
  );
}
