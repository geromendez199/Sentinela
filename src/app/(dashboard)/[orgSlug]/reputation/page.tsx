import { requireOrg } from '@/lib/auth/require-role';
import { createClient } from '@/lib/supabase/server';
import { Card, EmptyState } from '@/components/ui/card';
import { MetricHeadroomCard } from '@/components/reputation/metric-headroom-card';
import { IncidentExpiryTimeline, type ExpiryEntry } from '@/components/reputation/incident-expiry-timeline';
import { TwinFidelityBadge } from '@/components/reputation/twin-fidelity-badge';
import { formatDateTime, formatRate } from '@/lib/utils/format';
import type { MetricHeadroom } from '@/lib/reputation/types';

export default async function ReputationPage({ params }: { params: Promise<{ orgSlug: string }> }) {
  const { orgSlug } = await params;
  const ctx = await requireOrg(orgSlug);
  const supabase = await createClient();

  const [snapshots, computations, incidents] = await Promise.all([
    supabase
      .from('reputation_snapshots')
      .select('*')
      .eq('org_id', ctx.orgId)
      .order('observed_at', { ascending: false })
      .limit(5),
    supabase
      .from('reputation_computations')
      .select('*')
      .eq('org_id', ctx.orgId)
      .order('computed_at', { ascending: false })
      .limit(1),
    supabase
      .from('reputation_incidents')
      .select('order_id, incident_type, projected_expiry_at, affect_source')
      .eq('org_id', ctx.orgId)
      .not('projected_expiry_at', 'is', null)
      .order('projected_expiry_at', { ascending: true })
      .limit(20),
  ]);

  const official = snapshots.data?.[0];
  const twin = computations.data?.[0];
  const headroom = (twin?.headroom as { metrics?: MetricHeadroom[] } | null)?.metrics ?? [];

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
      <div className="grid gap-4 md:grid-cols-2">
        <Card title="Oficial observado" subtitle="Nunca se reinterpreta ni se reemplaza por el calculo interno">
          {official ? (
            <dl className="space-y-1 text-sm">
              <div className="flex justify-between">
                <dt className="muted">Nivel</dt>
                <dd>{official.level_id ?? '—'}</dd>
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
            <EmptyState message="Sin snapshot oficial." />
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
            <EmptyState message="El gemelo todavia no fue calculado." />
          )}
        </Card>
      </div>

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
