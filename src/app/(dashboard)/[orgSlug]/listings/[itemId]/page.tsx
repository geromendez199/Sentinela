import { notFound } from 'next/navigation';
import { requireOrg } from '@/lib/auth/require-role';
import { createClient } from '@/lib/supabase/server';
import { Card, EmptyState } from '@/components/ui/card';
import { formatCount } from '@/lib/utils/format';
import { ListingHealthCard } from '@/components/listings/health-card';
import { calculateCx } from '@/lib/listings/health';

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
  for (const result of [item, suggestions, clusters]) {
    if (result.error) throw new Error('data_load_failed');
  }

  if (!item.data) notFound();
  const accountId=item.data.meli_account_id;
  const {data:lines,count:lineCount}=await supabase.from('order_items').select('order_id',{count:'exact'}).eq('org_id',ctx.orgId).eq('meli_account_id',accountId).eq('item_id',itemId).order('created_at',{ascending:false}).limit(250).throwOnError();
  const candidateIds=[...new Set((lines??[]).map(line=>line.order_id))];
  const since=new Date(Date.now()-60*86400000).toISOString();
  const observedOrders=candidateIds.length?(await supabase.from('orders').select('order_id').eq('org_id',ctx.orgId).eq('meli_account_id',accountId).in('order_id',candidateIds).gte('date_created',since).neq('status','cancelled').throwOnError()).data??[]:[];
  const orderIds=observedOrders.map(order=>order.order_id);
  const relatedClaims=orderIds.length?(await supabase.from('claims').select('order_id').eq('org_id',ctx.orgId).eq('meli_account_id',accountId).in('order_id',orderIds).limit(1000).throwOnError()).data??[]:[];
  const cx=calculateCx(orderIds,relatedClaims.map(claim=>claim.order_id));

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

      <ListingHealthCard input={{title:item.data.title,status:item.data.status,availableQuantity:item.data.available_quantity,raw:item.data.raw_sanitized}} />
      <Card title="Experiencia observada del comprador" subtitle="Muestra de ventas de los últimos 60 días con reclamos asociados. No equivale al indicador oficial NCX de Amazon ni al termómetro de Mercado Libre."><div className="grid gap-4 sm:grid-cols-3"><div><p className="muted text-xs">Ventas observadas</p><p className="metric-number">{cx.sales}</p></div><div><p className="muted text-xs">Ventas con reclamo</p><p className="metric-number">{cx.affectedSales}</p></div><div><p className="muted text-xs">Incidencia en la muestra</p><p className="metric-number">{cx.rate===null?'—':`${(cx.rate*100).toFixed(1)}%`}</p></div></div><p className="muted mt-4 text-xs">{cx.health==='insufficient'?'Menos de 20 ventas: muestra pequeña para interpretar tendencias.':cx.health==='unknown'?'No hay ventas observadas suficientes.':cx.health==='critical'?'Incidencia alta en la muestra: investigá los reclamos.':cx.health==='watch'?'Revisá los motivos antes de modificar la publicación.':'Seguí monitoreando las señales del producto.'} {(lineCount??0)>250?'Muestra parcial: se revisan hasta 250 líneas de venta sincronizadas.':''} {relatedClaims.length>=1000?'El límite de reclamos de la muestra se alcanzó; la incidencia puede estar subestimada.':''}</p></Card>

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
        subtitle="Revisá la evidencia antes de cambiar la ficha. Las sugerencias no modifican la publicación automáticamente."
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
