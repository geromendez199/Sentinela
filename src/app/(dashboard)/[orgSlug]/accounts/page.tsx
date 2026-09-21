import Link from 'next/link';
import { requireOrg } from '@/lib/auth/require-role';
import { createClient } from '@/lib/supabase/server';
import { Card } from '@/components/ui/card';
import { DataTable } from '@/components/ui/data-table';
import { formatDateTime } from '@/lib/utils/format';
import { ConnectAccountButton } from '@/components/settings/connect-account-button';
import { hasPermission } from '@/lib/auth/permissions';

const STATUS_HELP: Record<string, string> = {
  onboarding: 'OAuth completado, sin bootstrap. No se muestra score definitivo.',
  backfilling: 'Carga historica en progreso; confianza parcial.',
  active: 'Token valido y sincronizacion saludable.',
  degraded: 'Errores transitorios, drift alto o datos incompletos.',
  reconnect_required: 'invalid_grant o permiso revocado: hace falta nueva autorizacion.',
  restricted: 'Restriccion o suspension observada: writes bloqueados.',
  disconnected: 'Vinculo removido; los datos siguen la politica de retencion.',
};

export default async function AccountsPage({ params }: { params: Promise<{ orgSlug: string }> }) {
  const { orgSlug } = await params;
  const ctx = await requireOrg(orgSlug);
  const supabase = await createClient();

  const { data } = await supabase
    .from('meli_accounts')
    .select('*')
    .eq('org_id', ctx.orgId)
    .order('nickname', { ascending: true });

  return (
    <div className="space-y-6">
      {hasPermission(ctx.role, 'accounts:connect') && <ConnectAccountButton orgSlug={orgSlug} />}

      <Card title="Cuentas MercadoLibre">
        <DataTable
          rows={data ?? []}
          rowKey={(row) => row.id}
          empty="Sin cuentas vinculadas."
          columns={[
            {
              key: 'account',
              header: 'Cuenta',
              render: (row) => (
                <Link className="underline" href={`/${orgSlug}/accounts/${row.id}`}>
                  {row.nickname ?? row.seller_id}
                </Link>
              ),
            },
            { key: 'site', header: 'Sitio', render: (row) => row.site_id },
            {
              key: 'status',
              header: 'Estado',
              render: (row) => <span title={STATUS_HELP[row.status]}>{row.status}</span>,
            },
            { key: 'linked', header: 'Vinculada', render: (row) => formatDateTime(row.linked_at) },
            { key: 'api', header: 'Ultimo API ok', render: (row) => formatDateTime(row.last_api_ok_at) },
          ]}
        />
      </Card>
    </div>
  );
}
