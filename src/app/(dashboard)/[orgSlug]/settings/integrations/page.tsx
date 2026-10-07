import { requirePermission } from '@/lib/auth/require-role';
import { createClient } from '@/lib/supabase/server';
import { Card } from '@/components/ui/card';
import { DEFAULT_CAPABILITIES } from '@/lib/meli/capabilities';
import { ConnectAccountButton } from '@/components/settings/connect-account-button';

export default async function IntegrationsPage({ params }: { params: Promise<{ orgSlug: string }> }) {
  const { orgSlug } = await params;
  const ctx = await requirePermission(orgSlug, 'org:update');
  const supabase = await createClient();

  const { data } = await supabase
    .from('meli_accounts')
    .select('id, nickname, site_id, status')
    .eq('org_id', ctx.orgId).throwOnError();

  return (
    <div className="space-y-6">
      <ConnectAccountButton orgSlug={orgSlug} />
      <Card title="Cuentas vinculadas" subtitle={`Organizacion ${orgSlug}`}>
        <ul className="space-y-2 text-sm">
          {(data ?? []).map((account) => (
            <li key={account.id} className="flex justify-between">
              <span>
                {account.nickname ?? account.id} · {account.site_id}
              </span>
              <span className="muted">{account.status}</span>
            </li>
          ))}
          {(data ?? []).length === 0 && <li className="muted">Sin cuentas.</li>}
        </ul>
      </Card>

      <Card
        title="Capabilities de contrato"
        subtitle="Cada punto [NO VERIFICADO] queda detras de un flag hasta pasar su contract test empirico."
      >
        <ul className="space-y-2 text-sm">
          {Object.entries(DEFAULT_CAPABILITIES).map(([key, capability]) => (
            <li key={key} className="flex flex-wrap justify-between gap-1">
              <span className="font-medium">{key}</span>
              <span className="muted">
                {capability.enabled ? 'habilitada' : 'deshabilitada'} · {capability.verification}
              </span>
              <span className="muted w-full text-xs">{capability.note}</span>
            </li>
          ))}
        </ul>
      </Card>
    </div>
  );
}
