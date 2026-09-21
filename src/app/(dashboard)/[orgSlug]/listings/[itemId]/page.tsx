import { notFound } from 'next/navigation';
import { requireOrg } from '@/lib/auth/require-role';
import { createClient } from '@/lib/supabase/server';
import { Card, EmptyState } from '@/components/ui/card';
import { formatCount } from '@/lib/utils/format';

export default async function ListingDetailPage({
  params,
}: {
  params: Promise<{ orgSlug: string; itemId: string }>;
}) {
  const { orgSlug, itemId } = await params;
  const ctx = await requireOrg(orgSlug);
  const supabase = await createClient();

  const [item, suggestions, clusters] = await Promise.all([
    supabase.from('items').select('*').eq('org_id', ctx.orgId).eq('item_id', itemId).maybeSingle(),
    supabase
      .from('listing_suggestions')
      .select('*')
      .eq('org_id', ctx.orgId)
      .eq('item_id', itemId)
      .order('created_at', { ascending: false }),
    supabase
      .from('root_cause_clusters')
      .select('*')
      .eq('org_id', ctx.orgId)
      .eq('item_id', itemId)
      .order('sample_count', { ascending: false }),
  ]);

  if (!item.data) notFound();

  return (
    <div className="space-y-6">
      <Card title={item.data.title ?? item.data.item_id} subtitle={`Organizacion ${orgSlug}`}>
        <dl className="grid gap-2 text-sm md:grid-cols-2">
          <div className="flex justify-between">
            <dt className="muted">Estado</dt>
            <dd>{item.data.status ?? '—'}</dd>
          </div>
          <div className="flex justify-between">
            <dt className="muted">Stock publicado</dt>
            <dd>{formatCount(item.data.available_quantity)}</dd>
          </div>
          <div className="flex justify-between">
            <dt className="muted">Categoria</dt>
            <dd>{item.data.category_id ?? '—'}</dd>
          </div>
        </dl>
      </Card>

      <Card title="Clusters de causa raiz">
        {(clusters.data ?? []).length === 0 ? (
          <EmptyState message="Sin patrones detectados." />
        ) : (
          <ul className="space-y-2 text-sm">
            {(clusters.data ?? []).map((cluster) => (
              <li key={cluster.id} className="flex justify-between">
                <span>{cluster.label}</span>
                <span className="muted">
                  {formatCount(cluster.sample_count)} casos · tendencia{' '}
                  {cluster.trend_score === null ? '—' : cluster.trend_score.toFixed(2)}
                </span>
              </li>
            ))}
          </ul>
        )}
      </Card>

      <Card
        title="Sugerencias de ficha"
        subtitle="El MVP nunca edita la publicacion automaticamente: la sugerencia pasa por action_draft"
      >
        {(suggestions.data ?? []).length === 0 ? (
          <EmptyState message="Sin sugerencias." />
        ) : (
          <ul className="space-y-3 text-sm">
            {(suggestions.data ?? []).map((suggestion) => (
              <li key={suggestion.id} className="card p-3">
                <div className="flex justify-between">
                  <span className="font-medium">{suggestion.suggestion_type}</span>
                  <span className="muted">
                    {formatCount(suggestion.evidence_count)} evidencias · {suggestion.status}
                  </span>
                </div>
                <p className="mt-2">{suggestion.rationale}</p>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  );
}
