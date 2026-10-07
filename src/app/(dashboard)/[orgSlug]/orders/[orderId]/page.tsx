import { notFound } from 'next/navigation';
import { requireOrg } from '@/lib/auth/require-role';
import { createClient } from '@/lib/supabase/server';
import { Card, EmptyState } from '@/components/ui/card';
import { RiskScoreBadge } from '@/components/risk/risk-score-badge';
import { FeatureContributions } from '@/components/risk/feature-contributions';
import { formatDateTime } from '@/lib/utils/format';
import type { Explanation } from '@/lib/risk/explanations';

export default async function OrderDetailPage({
  params,
}: {
  params: Promise<{ orgSlug: string; orderId: string }>;
}) {
  const { orgSlug, orderId } = await params;
  const ctx = await requireOrg(orgSlug);
  const supabase = await createClient();

  const numericOrderId = Number(orderId);
  if (!Number.isFinite(numericOrderId)) notFound();

  const [order, risk, shipment, claims] = await Promise.all([
    supabase.from('orders').select('*').eq('org_id', ctx.orgId).eq('order_id', numericOrderId).maybeSingle(),
    supabase
      .from('risk_scores')
      .select('*')
      .eq('org_id', ctx.orgId)
      .eq('order_id', numericOrderId)
      .order('computed_at', { ascending: false })
      .limit(1),
    supabase.from('shipments').select('*').eq('org_id', ctx.orgId).limit(1),
    supabase.from('claims').select('*').eq('org_id', ctx.orgId).eq('order_id', numericOrderId),
  ]);
  for (const result of [order, risk, shipment, claims]) {
    if (result.error) throw new Error('data_load_failed');
  }

  if (!order.data) notFound();

  const latestRisk = risk.data?.[0];
  const explanations = (latestRisk?.explanations as Explanation[] | null) ?? [];

  return (
    <div className="space-y-6">
      <Card title={`Orden ${order.data.order_id}`}>
        <dl className="grid gap-2 text-sm md:grid-cols-2">
          <div className="flex justify-between">
            <dt className="muted">Estado</dt>
            <dd>{order.data.status}</dd>
          </div>
          <div className="flex justify-between">
            <dt className="muted">Pack</dt>
            <dd>{order.data.pack_id ?? '—'}</dd>
          </div>
          <div className="flex justify-between">
            <dt className="muted">Creada</dt>
            <dd>{formatDateTime(order.data.date_created)}</dd>
          </div>
          <div className="flex justify-between">
            <dt className="muted">Actualizada en origen</dt>
            <dd>{formatDateTime(order.data.source_last_updated)}</dd>
          </div>
        </dl>
      </Card>

      <Card title="Riesgo y explicacion">
        {latestRisk ? (
          <div className="space-y-4">
            <RiskScoreBadge score={latestRisk.risk_probability} band={latestRisk.risk_band} />
            <FeatureContributions explanations={explanations} />
          </div>
        ) : (
          <EmptyState message="Todavia sin score para esta orden." />
        )}
      </Card>

      <Card title="Reclamos asociados">
        {(claims.data ?? []).length === 0 ? (
          <EmptyState message="Sin reclamos." />
        ) : (
          <ul className="space-y-1 text-sm">
            {(claims.data ?? []).map((claim) => (
              <li key={claim.claim_id} className="flex justify-between">
                <span>
                  {claim.claim_id} · {claim.status ?? '—'}
                </span>
                <span className="muted">
                  afecta reputacion: {claim.affects_reputation ?? 'sin consultar'}
                </span>
              </li>
            ))}
          </ul>
        )}
      </Card>

      {shipment.data && shipment.data.length === 0 && (
        <Card title="Envio">
          <EmptyState message="Sin envio sincronizado." />
        </Card>
      )}
    </div>
  );
}
