import { RefreshButton } from '@/components/ui/refresh-button';
import Link from 'next/link';
import { requireOrg } from '@/lib/auth/require-role';
import { createClient } from '@/lib/supabase/server';
import { Card, EmptyState } from '@/components/ui/card';
import { TwinFidelityBadge } from '@/components/reputation/twin-fidelity-badge';
import { RiskQueue } from '@/components/risk/risk-queue';
import { formatCount, formatDateTime, formatRate } from '@/lib/utils/format';
import { GettingStarted } from '@/components/accounts/getting-started';
import { SyncAutoRefresh } from '@/components/accounts/sync-auto-refresh';
import { statusLabel } from '@/lib/ui/labels';
import { OfficialLevel } from '@/components/reputation/official-level';

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
    supabase.from('alerts').select('*', { count: 'exact' }).eq('org_id', ctx.orgId).eq('status', 'open').order('created_at', { ascending: false }).limit(10),
    supabase
      .from('action_drafts')
      .select('id, kind, status, created_at', { count: 'exact' })
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
      <div className="flex flex-wrap items-center justify-between gap-3"><p className="muted text-xs">{accountRows.length ? 'Tu operación, con los últimos datos disponibles.' : 'Conectá tu primera cuenta para empezar.'}</p><RefreshButton /></div>
      {(!accountRows.some(account => account.status === 'active') || backfilling.length > 0) && <GettingStarted orgSlug={orgSlug} connected={accountRows.some(account => account.status !== 'disconnected')} syncing={backfilling.length > 0} ready={Boolean(reputation.data?.length || computations.data?.length)} />}
      <SyncAutoRefresh active={backfilling.length > 0} />
      <section className="card card-dark p-5 sm:p-6" aria-labelledby="today-priorities"><div className="flex flex-wrap items-start justify-between gap-3"><div><p className="text-[10px] font-semibold uppercase tracking-widest text-neutral-400">Tu próxima decisión</p><h2 id="today-priorities" className="mt-2 text-xl font-semibold">Lo que necesita tu atención</h2><p className="mt-2 text-xs text-neutral-300">Empezá por las señales urgentes y revisá las propuestas antes de ejecutarlas.</p></div><Link href={`/${orgSlug}/claims?status=opened&sort=deadline`} className="inline-flex min-h-10 items-center rounded-lg border border-neutral-600 px-3 text-xs hover:bg-neutral-800">Reclamos por vencimiento →</Link></div><div className="mt-5 grid gap-3 sm:grid-cols-3">{[{ label: 'Evaluaciones de riesgo alto', count: risk.count ?? 0, href: 'risk' }, { label: 'Alertas sin leer', count: alerts.count ?? 0, href: 'alerts?status=open' }, { label: 'Propuestas por revisar', count: actions.count ?? 0, href: 'actions' }].map(item => <Link key={item.href} href={`/${orgSlug}/${item.href}`} className="rounded-xl border border-neutral-700 p-4 hover:bg-neutral-800"><p className="text-3xl font-semibold tabular-nums">{formatCount(item.count)}</p><p className="mt-2 text-xs text-neutral-300">{item.label} <span aria-hidden="true">↗</span></p></Link>)}</div></section>
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

      <div className="grid gap-3 sm:grid-cols-3" aria-label="Acciones rápidas">
        <Link href={`/${orgSlug}/accounts`} className="card group flex items-center justify-between p-4 hover:border-black">
          <span><span className="page-eyebrow block">Conexiones</span><span className="mt-1 block text-sm font-semibold">Administrar cuentas</span></span><span className="text-lg transition-transform group-hover:translate-x-1" aria-hidden="true">→</span>
        </Link>
        <Link href={`/${orgSlug}/risk`} className="card group flex items-center justify-between p-4 hover:border-black">
          <span><span className="page-eyebrow block">Prioridad</span><span className="mt-1 block text-sm font-semibold">Revisar riesgo</span></span><span className="text-lg transition-transform group-hover:translate-x-1" aria-hidden="true">→</span>
        </Link>
        <Link href={`/${orgSlug}/claims`} className="card group flex items-center justify-between p-4 hover:border-black">
          <span><span className="page-eyebrow block">Atención</span><span className="mt-1 block text-sm font-semibold">Ver reclamos</span></span><span className="text-lg transition-transform group-hover:translate-x-1" aria-hidden="true">→</span>
        </Link>
      </div>

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
            <EmptyState message="El cálculo se genera con los datos sincronizados." action={<Link href={`/${orgSlug}/accounts`} className="text-xs font-medium underline">Ver sincronización →</Link>} />
          )}
        </Card>
      </div>

      <Card title="Reputacion oficial observada" subtitle="Última información recibida de Mercado Libre.">
        {(reputation.data ?? []).length === 0 ? (
          <EmptyState message="La reputación oficial aparecerá al completar la primera lectura de Mercado Libre." action={<Link href={`/${orgSlug}/accounts`} className="text-xs font-medium underline">Revisar cuentas →</Link>} />
        ) : (
          <ul className="space-y-2 text-sm">
            {(reputation.data ?? []).map((row) => (
              <li key={row.meli_account_id} className="flex flex-wrap justify-between gap-2">
                <span><OfficialLevel level={row.level_id} /> · {row.power_seller_status ?? 'Sin medalla'}</span>
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
        <Card title="Alertas abiertas" subtitle="Seguimiento de los avisos que necesitan atención.">
          {(alerts.data ?? []).length === 0 ? (
            <EmptyState message="Sin alertas abiertas." />
          ) : (
            <ul className="space-y-2 text-sm">
              {(alerts.data ?? []).map((alert) => (
                <li key={alert.id} className="rounded-lg border p-3">
                  <span className="font-medium">{alert.title}</span>
                  <span className="muted"> · {statusLabel(alert.severity)}</span>
                </li>
              ))}
            </ul>
          )}
          <Link href={`/${orgSlug}/alerts?status=open`} className="mt-4 inline-flex min-h-10 items-center text-xs font-medium underline">Abrir centro de alertas →</Link>
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
          <Link href={`/${orgSlug}/actions`} className="mt-4 inline-flex min-h-10 items-center text-xs font-medium underline">Revisar acciones →</Link>
        </Card>
      </div>
    </div>
  );
}
