import Link from 'next/link';
import { requireOrg } from '@/lib/auth/require-role';
import { createClient } from '@/lib/supabase/server';
import { Card } from '@/components/ui/card';
import { DataTable } from '@/components/ui/data-table';
import { formatDateTime } from '@/lib/utils/format';
import { ConnectAccountButton } from '@/components/settings/connect-account-button';
import { hasPermission } from '@/lib/auth/permissions';

const STATUS_LABELS: Record<string, string> = { onboarding: 'Preparando conexión', backfilling: 'Cargando historial', active: 'Activa', degraded: 'Requiere revisión', reconnect_required: 'Reconexión pendiente', restricted: 'Restringida', disconnected: 'Desconectada' };

const STATUS_HELP: Record<string, string> = {
  onboarding: 'Cuenta autorizada. Estamos preparando la primera carga.',
  backfilling: 'Importando el historial. Los indicadores todavía son parciales.',
  active: 'La conexión y la sincronización están operativas.',
  degraded: 'Hay datos incompletos o errores de sincronización. Revisá el detalle.',
  reconnect_required: 'Mercado Libre necesita que vuelvas a autorizar el acceso.',
  restricted: 'Mercado Libre informa una restricción. Las acciones están bloqueadas.',
  disconnected: 'La sincronización está detenida. Los datos conservados siguen disponibles.',
};

export default async function AccountsPage({ params }: { params: Promise<{ orgSlug: string }> }) {
  const { orgSlug } = await params;
  const ctx = await requireOrg(orgSlug);
  const supabase = await createClient();

  const { data } = await supabase
    .from('meli_accounts')
    .select('*')
    .eq('org_id', ctx.orgId)
    .order('nickname', { ascending: true }).throwOnError();

  return (
    <div className="space-y-6">
      {hasPermission(ctx.role, 'accounts:connect') && <ConnectAccountButton orgSlug={orgSlug} />}

      {(data ?? []).length === 0 && (
        <Card className="card-dark overflow-hidden" title="Empezá por conectar tu operación" subtitle="Tus primeras señales aparecen cuando termine la sincronización inicial.">
          <div className="grid gap-5 sm:grid-cols-3">
            {[['01', 'Conectá Mercado Libre', 'Autorizá el acceso de forma segura, sin compartir tu contraseña.'], ['02', 'Esperá la carga inicial', 'Traemos órdenes, reclamos y publicaciones. Los datos se muestran como parciales durante este paso.'], ['03', 'Tomá decisiones', 'Recibí prioridades de riesgo y señales para intervenir antes.']].map(([number, title, description]) => (
              <div key={number} className="border-t border-white/20 pt-3"><span className="text-xs text-neutral-400">{number}</span><h3 className="mt-2 text-sm font-semibold">{title}</h3><p className="mt-2 text-xs leading-relaxed text-neutral-300">{description}</p></div>
            ))}
          </div>
        </Card>
      )}

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
              render: (row) => <span className="inline-flex items-center gap-2 whitespace-nowrap rounded-full border bg-neutral-50 px-3 py-1 text-xs" title={STATUS_HELP[row.status]}><span aria-hidden="true" className={`h-1.5 w-1.5 rounded-full ${row.status === 'active' ? 'bg-black' : 'bg-neutral-400'}`} />{STATUS_LABELS[row.status] ?? row.status}</span>,
            },
            { key: 'linked', header: 'Vinculada', render: (row) => formatDateTime(row.linked_at) },
            { key: 'api', header: 'Ultimo API ok', render: (row) => formatDateTime(row.last_api_ok_at) },
          ]}
        />
      </Card>
    </div>
  );
}
