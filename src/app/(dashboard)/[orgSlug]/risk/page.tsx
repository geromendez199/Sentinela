import { requireOrg } from '@/lib/auth/require-role';
import { createClient } from '@/lib/supabase/server';
import { Card } from '@/components/ui/card';
import { RiskQueue } from '@/components/risk/risk-queue';

export default async function RiskPage({ params }: { params: Promise<{ orgSlug: string }> }) {
  const { orgSlug } = await params;
  const ctx = await requireOrg(orgSlug);
  const supabase = await createClient();

  const { data } = await supabase
    .from('risk_scores')
    .select('id, order_id, risk_probability, risk_band, computed_at')
    .eq('org_id', ctx.orgId)
    .order('risk_probability', { ascending: false })
    .limit(100);

  return (
    <Card
      title="Cola de riesgo por orden"
      subtitle="Score heuristico explicable. No es una probabilidad calibrada hasta tener labels suficientes."
    >
      <RiskQueue orgSlug={orgSlug} rows={data ?? []} />
    </Card>
  );
}
