import { requireOrg } from '@/lib/auth/require-role';
import { createClient } from '@/lib/supabase/server';
import { Card, EmptyState } from '@/components/ui/card';
import { MetricHeadroomCard } from '@/components/reputation/metric-headroom-card';
import { IncidentExpiryTimeline, type ExpiryEntry } from '@/components/reputation/incident-expiry-timeline';
import { TwinFidelityBadge } from '@/components/reputation/twin-fidelity-badge';
import { formatDateTime, formatRate } from '@/lib/utils/format';
import type { MetricHeadroom } from '@/lib/reputation/types';
import { calculateAccountHealth } from '@/lib/reputation/account-health';
import { AccountHealthCard } from '@/components/reputation/account-health-card';
import Link from 'next/link';
import { OfficialLevel } from '@/components/reputation/official-level';
import type { ListParams } from '@/lib/ui/list-query';

export default async function ReputationPage({ params, searchParams }: { params: Promise<{ orgSlug: string }>; searchParams: Promise<ListParams> }) {
  const { orgSlug } = await params;
  const ctx = await requireOrg(orgSlug);
  const supabase = await createClient();
  const requested = (await searchParams).account;
  const { data: accounts } = await supabase.from('meli_accounts').select('id, nickname, seller_id').eq('org_id', ctx.orgId).order('nickname').throwOnError();
  const selectedAccount = accounts?.find(account => account.id === requested) ?? accounts?.[0];

  const [snapshots, computations, incidents] = await Promise.all([
    supabase
      .from('reputation_snapshots')
      .select('*')
      .eq('org_id', ctx.orgId)
      .eq('meli_account_id', selectedAccount?.id ?? '00000000-0000-0000-0000-000000000000')
      .order('observed_at', { ascending: false })
      .limit(5),
    supabase
      .from('reputation_computations')
      .select('*')
      .eq('org_id', ctx.orgId)
      .eq('meli_account_id', selectedAccount?.id ?? '00000000-0000-0000-0000-000000000000')
      .order('computed_at', { ascending: false })
      .limit(1),
    supabase
      .from('reputation_incidents')
      .select('order_id, incident_type, projected_expiry_at, affect_source')
      .eq('org_id', ctx.orgId)
      .eq('meli_account_id', selectedAccount?.id ?? '00000000-0000-0000-0000-000000000000')
      .not('projected_expiry_at', 'is', null)
      .order('projected_expiry_at', { ascending: true })
      .limit(20),
  ]);
  for (const result of [snapshots, computations, incidents]) {
    if (result.error) throw new Error('data_load_failed');
  }

  const official = snapshots.data?.[0];
  const twin = computations.data?.[0];
  const headroom = (twin?.headroom as { metrics?: MetricHeadroom[] } | null)?.metrics ?? [];
  const health = official ? calculateAccountHealth({
    orders: official.sales_completed ?? 0,
    claimsAffectingReputation: official.claims_value ?? 0,
    mediations: 0,
    lateShipments: official.delay_value ?? 0,
    shippedOrders: 0,
    sellerCancellations: official.cancellations_value ?? 0,
    trackedShipments: 0,
    scannedOnTime: 0,
    headroom,
  }) : calculateAccountHealth({ orders: 0, claimsAffectingReputation: 0, mediations: 0, lateShipments: 0, shippedOrders: 0, sellerCancellations: 0, trackedShipments: 0, scannedOnTime: 0 });

  const expiries: ExpiryEntry[] = (incidents.data ?? [])
    .filter((row): row is typeof row & { projected_expiry_at: string } => row.projected_expiry_at !== null)
    .map((row) => ({
    orderId: row.order_id,
    metric: row.incident_type,
    expiresAt: row.projected_expiry_at,
    // An expiry derived locally is estimated until an official snapshot confirms it.
    estimated: row.affect_source !== 'official',
  }));

  return (
    <div className="space-y-6">
      {selectedAccount && <form className="card flex flex-wrap items-end gap-3 p-4"><label className="flex-1 text-xs font-medium">Cuenta Mercado Libre<select name="account" defaultValue={selectedAccount.id} className="mt-2 block w-full border px-3 py-2 text-sm">{(accounts ?? []).map(account => <option key={account.id} value={account.id}>{account.nickname ?? String(account.seller_id)}</option>)}</select></label><button className="min-h-10 rounded-lg bg-black px-4 text-xs text-white">Ver reputación</button><p className="muted w-full text-[11px]">La reputación oficial, el cálculo y los incidentes corresponden a esta misma cuenta.</p></form>}
      <div className="grid gap-4 md:grid-cols-2">
        <Card title="Oficial observado" subtitle="Nunca se reinterpreta ni se reemplaza por el calculo interno">
          {official ? (
            <dl className="space-y-1 text-sm">
              <div className="flex justify-between">
                <dt className="muted">Nivel</dt>
                <dd><OfficialLevel level={official.level_id} /></dd>
              </div>
              <div className="flex justify-between">
                <dt className="muted">Medalla</dt>
                <dd>{official.power_seller_status ?? '—'}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="muted">Reclamos ({official.claims_period ?? '—'})</dt>
                <dd>{formatRate(official.claims_rate)}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="muted">Cancelaciones</dt>
                <dd>{formatRate(official.cancellations_rate)}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="muted">Demoras de despacho</dt>
                <dd>{formatRate(official.delay_rate)}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="muted">Observado</dt>
                <dd>{formatDateTime(official.observed_at)}</dd>
              </div>
            </dl>
          ) : (
            <EmptyState message="La reputación oficial aparecerá después de la primera lectura de tu cuenta." action={<Link href={`/${orgSlug}/accounts`} className="text-xs underline">Revisar sincronización →</Link>} />
          )}
        </Card>

        <Card title="Gemelo calculado" subtitle="Etiquetado como calculado; el drift se muestra siempre">
          {twin ? (
            <>
              <TwinFidelityBadge fidelity={twin.fidelity} />
              <dl className="mt-3 space-y-1 text-sm">
                <div className="flex justify-between">
                  <dt className="muted">Reclamos</dt>
                  <dd>{formatRate(twin.claims_rate)}</dd>
                </div>
                <div className="flex justify-between">
                  <dt className="muted">Cancelaciones</dt>
                  <dd>{formatRate(twin.cancellations_rate)}</dd>
                </div>
                <div className="flex justify-between">
                  <dt className="muted">Demoras</dt>
                  <dd>{formatRate(twin.delay_rate)}</dd>
                </div>
                <div className="flex justify-between">
                  <dt className="muted">Ventana</dt>
                  <dd>
                    {formatDateTime(twin.window_start)} → {formatDateTime(twin.window_end)}
                  </dd>
                </div>
              </dl>
            </>
          ) : (
            <EmptyState message="Todavía faltan datos para reconstruir la reputación." action={<Link href={`/${orgSlug}/accounts`} className="text-xs underline">Ver estado de la cuenta →</Link>} />
          )}
        </Card>
      </div>

      <AccountHealthCard health={health} />

      <section>
        <h2 className="mb-3 text-sm font-semibold">Margen de seguridad por metrica</h2>
        {headroom.length === 0 ? (
          <EmptyState message="Sin margenes calculados." />
        ) : (
          <div className="grid gap-4 md:grid-cols-3">
            {headroom.map((entry) => (
              <MetricHeadroomCard key={entry.metric} headroom={entry} />
            ))}
          </div>
        )}
      </section>

      <Card title="Salida de incidentes de la ventana">
        <IncidentExpiryTimeline entries={expiries} />
      </Card>
    </div>
  );
}
