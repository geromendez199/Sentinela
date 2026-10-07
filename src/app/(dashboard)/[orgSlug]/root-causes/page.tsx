import { requireOrg } from '@/lib/auth/require-role';
import { createClient } from '@/lib/supabase/server';
import { Card } from '@/components/ui/card';
import { DataTable } from '@/components/ui/data-table';
import { formatCount, formatDateTime } from '@/lib/utils/format';
import Link from 'next/link';

export default async function RootCausesPage({ params }: { params: Promise<{ orgSlug: string }> }) {
  const { orgSlug } = await params;
  const ctx = await requireOrg(orgSlug);
  const supabase = await createClient();

  const { data } = await supabase
    .from('root_cause_clusters')
    .select('*')
    .eq('org_id', ctx.orgId)
    .eq('status', 'active')
    .order('sample_count', { ascending: false })
    .limit(50).throwOnError();

  return (
    <div className="space-y-6">
    {(data ?? []).length > 0 && <Card title="Patrones con más casos" subtitle="Frecuencia observada en los grupos disponibles. Revisá la publicación antes de intervenir."><ol className="space-y-4">{(data ?? []).slice(0,5).map(row => <li key={row.id}><div className="mb-2 flex justify-between gap-3 text-sm"><span className="font-medium">{row.label}</span><span className="muted whitespace-nowrap">{formatCount(row.sample_count)} casos</span></div><progress className="h-2 w-full" value={row.sample_count} max={Math.max(1, data?.[0]?.sample_count ?? 1)} aria-label={`${row.label}: ${row.sample_count} casos`} /></li>)}</ol></Card>}
    <Card
      title="Causas detectadas"
      subtitle="Patrones encontrados en los reclamos. La tendencia ayuda a identificar dónde investigar."
    >
      <DataTable
        rows={data ?? []}
        rowKey={(row) => row.id}
        empty="Sin clusters todavia."
        emptyAction={<Link href={`/${orgSlug}/claims`} className="text-xs underline">Revisar reclamos sincronizados →</Link>}
        columns={[
          { key: 'label', header: 'Patron', render: (row) => row.label },
          { key: 'item', header: 'Publicación', render: (row) => row.item_id ? <Link className="underline" href={`/${orgSlug}/listings/${row.item_id}`}>{row.item_id}</Link> : 'Sin publicación asociada' },
          { key: 'size', header: 'Casos', exportValue: (row) => row.sample_count, render: (row) => formatCount(row.sample_count) },
          {
            key: 'trend',
            header: 'Tendencia',
            render: (row) => (row.trend_score === null ? '—' : row.trend_score.toFixed(2)),
          },
          { key: 'last', header: 'Último caso', exportValue: (row) => row.last_seen_at ?? '', render: (row) => formatDateTime(row.last_seen_at) },
        ]}
      />
    </Card>
    </div>
  );
}
