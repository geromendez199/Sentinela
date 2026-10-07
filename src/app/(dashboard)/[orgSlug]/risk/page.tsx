import { requireOrg } from '@/lib/auth/require-role';
import { createClient } from '@/lib/supabase/server';
import { Card } from '@/components/ui/card';
import { RiskQueue } from '@/components/risk/risk-queue';
import { statusLabel } from '@/lib/ui/labels';

export default async function RiskPage({ params }: { params: Promise<{ orgSlug: string }> }) {
  const { orgSlug } = await params;
  const ctx = await requireOrg(orgSlug);
  const supabase = await createClient();

  const { data } = await supabase
    .from('risk_scores')
    .select('id, order_id, risk_probability, risk_band, computed_at')
    .eq('org_id', ctx.orgId)
    .order('risk_probability', { ascending: false })
    .limit(100).throwOnError();

  return (
    <div className="space-y-6">
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">{['critical', 'high', 'medium', 'low'].map(band => <div key={band} className={`card p-4 ${band === 'critical' ? 'card-dark' : ''}`}><p className="text-xs font-medium">Riesgo {statusLabel(band).toLowerCase()}</p><p className="mt-2 text-3xl font-semibold">{(data ?? []).filter(row => row.risk_band === band).length}</p><p className="muted mt-1 text-[11px]">Evaluaciones de esta vista</p></div>)}</div>
    <Card
      title="Cola de riesgo por orden"
      subtitle="Hasta 100 evaluaciones, de mayor a menor score. Puede haber varias por orden. El score es una señal heurística, no una probabilidad de reclamo."
    >
      <RiskQueue orgSlug={orgSlug} rows={data ?? []} />
    </Card>
    </div>
  );
}
