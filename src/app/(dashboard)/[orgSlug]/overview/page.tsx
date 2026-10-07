import { RefreshButton } from '@/components/ui/refresh-button';
import Link from 'next/link';
import { requireOrg } from '@/lib/auth/require-role';
import { createClient } from '@/lib/supabase/server';
import { Card, EmptyState } from '@/components/ui/card';
import { TwinFidelityBadge } from '@/components/reputation/twin-fidelity-badge';
import { RiskQueue } from '@/components/risk/risk-queue';
import { formatCount, formatDateTime, formatRate } from '@/lib/utils/format';

export default async function OverviewPage({ params }: { params: Promise<{ orgSlug: string }> }) {
  const { orgSlug } = await params;
  const ctx = await requireOrg(orgSlug);
  const supabase = await createClient();

  const [accounts, reputation, computations, risk, alerts, actions] = await Promise.all([
    supabase.from('meli_accounts').select('*').eq('org_id', ctx.orgId).order('nickname'),
    supabase.from('latest_reputation').select('*').eq('org_id', ctx.orgId),
    supabase
      .from('reputation_computations')
      .select('*')
      .eq('org_id', ctx.orgId)
      .order('computed_at', { ascending: false })
      .limit(10),
    supabase
      .from('risk_scores')
      .select('id, order_id, risk_probability, risk_band, computed_at', { count: 'exact' })
      .eq('org_id', ctx.orgId)
      .in('risk_band', ['high', 'critical'])
      .order('computed_at', { ascending: false })
      .limit(15),
    supabase.from('alerts').select('*').eq('org_id', ctx.orgId).eq('status', 'open').limit(10),
    supabase
      .from('action_drafts')
      .select('id, kind, status, created_at')
      .eq('org_id', ctx.orgId)
      .in('status', ['draft', 'pending_approval'])
      .limit(10),
  ]);

  for (const result of [accounts, reputation, computations, risk, alerts, actions]) {
    if (result.error) throw new Error('overview_load_failed');
  }
  const accountRows = accounts.data ?? [];
  const backfilling = accountRows.filter((account) => account.status === 'backfilling');
  const needsReconnect = accountRows.filter((account) => account.status === 'reconnect_required');
  const latestComputation = computations.data?.[0];

  return (
    <div className="space-y-6">
      <div className="flex justify-end"><RefreshButton /></div>
      {/* Confidence banner: the UI states when data is incomplete (DoD global). */}
      {(backfilling.length > 0 || needsReconnect.length > 0) && (
        <div className="card border-neutral-200 bg-white p-4 text-sm leading-relaxed text-neutral-700">
          {backfilling.length > 0 && (
            <p>
              {backfilling.length} cuenta(s) con carga histórica pendiente: los indicadores son parciales hasta que
              termine la carga histórica. <Link className="underline" href={`/${orgSlug}/accounts`}>Ver estado de las cuentas</Link>
            </p>
          )}
          {needsReconnect.length > 0 && (
            <p>
              {needsReconnect.length} cuenta(s) requieren reconexion OAuth.{' '}
              <Link className="underline" href={`/${orgSlug}/accounts`}>
                Revisar cuentas
              </Link>
            </p>
          )}
        </div>
      )}

      <div className="grid gap-4 md:grid-cols-3">
        <Card title="Cuentas vinculadas">
          <p className="metric-number">{formatCount(accountRows.filter(a => a.status !== 'disconnected').length)}</p>
          <p className="muted mt-1 text-xs">
            {accountRows.filter((a) => a.status === 'active').length} activas
          </p>
        </Card>
        <Card title="Evaluaciones de riesgo alto/crítico">
          <p className="metric-number">{backfilling.length && !risk.data?.length ? '—' : formatCount(risk.count ?? 0)}</p>
          <p className="muted mt-1 text-xs">Score heurístico. Las evaluaciones pueden incluir una misma orden.</p>
        </Card>
        <Card title="Gemelo de reputacion">
          {latestComputation ? (
            <>
              <TwinFidelityBadge fidelity={latestComputation.fidelity} />
              <p className="muted mt-2 text-xs">
                Ultimo calculo {formatDateTime(latestComputation.computed_at)}
              </p>
            </>
          ) : (
            <EmptyState message="Todavia sin calculo del gemelo." />
          )}
        </Card>
      </div>

      <Card title="Reputacion oficial observada" subtitle="Última información recibida de Mercado Libre.">
        {(reputation.data ?? []).length === 0 ? (
          <EmptyState message="Sin snapshots oficiales todavia." />
        ) : (
          <ul className="space-y-2 text-sm">
            {(reputation.data ?? []).map((row) => (
              <li key={row.meli_account_id} className="flex flex-wrap justify-between gap-2">
                <span>{row.level_id ?? 'sin nivel'} · {row.power_seller_status ?? 'sin medalla'}</span>
                <span className="muted">
                  reclamos {formatRate(row.claims_rate)} · cancelaciones {formatRate(row.cancellations_rate)} ·
                  demoras {formatRate(row.delay_rate)}
                </span>
              </li>
            ))}
          </ul>
        )}
      </Card>

      <Card title="Cola de riesgo">
        <RiskQueue orgSlug={orgSlug} rows={risk.data ?? []} />
      </Card>

      <div className="grid gap-4 md:grid-cols-2">
        <Card title="Alertas abiertas">
          {(alerts.data ?? []).length === 0 ? (
            <EmptyState message="Sin alertas abiertas." />
          ) : (
            <ul className="space-y-2 text-sm">
              {(alerts.data ?? []).map((alert) => (
                <li key={alert.id}>
                  <span className="font-medium">{alert.title}</span>
                  <span className="muted"> · {alert.severity}</span>
                </li>
              ))}
            </ul>
          )}
        </Card>
        <Card title="Acciones esperando aprobacion">
          {(actions.data ?? []).length === 0 ? (
            <EmptyState message="Sin borradores pendientes." />
          ) : (
            <ul className="space-y-2 text-sm">
              {(actions.data ?? []).map((action) => (
                <li key={action.id} className="flex justify-between">
                  <span>{action.kind}</span>
                  <span className="muted">{formatDateTime(action.created_at)}</span>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>
    </div>
  );
}
