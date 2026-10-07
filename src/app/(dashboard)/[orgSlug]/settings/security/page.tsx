import { requirePermission } from '@/lib/auth/require-role';
import { createClient } from '@/lib/supabase/server';
import { Card } from '@/components/ui/card';
import { formatDateTime } from '@/lib/utils/format';

export default async function SecurityPage({ params }: { params: Promise<{ orgSlug: string }> }) {
  const { orgSlug } = await params;
  const ctx = await requirePermission(orgSlug, 'org:update');
  const supabase = await createClient();

  const { data } = await supabase
    .from('meli_accounts')
    .select('id, nickname, status, status_reason, updated_at')
    .eq('org_id', ctx.orgId).throwOnError();

  return (
    <div className="space-y-6">
      <Card title="Kill switches">
        <ul className="space-y-1 text-sm">
          <li>Global: variable de entorno MELI_WRITES_ENABLED (MVP en false).</li>
          <li>Por organizacion y por cuenta: se evaluan en cada policy check antes del write.</li>
          <li>Ningun atajo temporal: un draft sin aprobacion humana nunca se ejecuta.</li>
        </ul>
      </Card>

      <Card title="Estado de credenciales" subtitle="Los tokens viven en Supabase Vault y nunca llegan al cliente.">
        <ul className="space-y-2 text-sm">
          {(data ?? []).map((account) => (
            <li key={account.id} className="flex flex-wrap justify-between gap-2">
              <span>{account.nickname ?? account.id}</span>
              <span className="muted">
                {account.status}
                {account.status_reason ? ` · ${account.status_reason}` : ''} ·{' '}
                {formatDateTime(account.updated_at)}
              </span>
            </li>
          ))}
          {(data ?? []).length === 0 && <li className="muted">Sin cuentas.</li>}
        </ul>
      </Card>
      <p className="muted text-xs">Organizacion {orgSlug}</p>
    </div>
  );
}
