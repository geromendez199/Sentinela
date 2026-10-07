import Link from 'next/link';
import { DataTable } from '@/components/ui/data-table';
import { RiskScoreBadge } from './risk-score-badge';
import { formatDateTime } from '@/lib/utils/format';
import { statusLabel } from '@/lib/ui/labels';

export interface RiskQueueRow {
  id: string;
  order_id: number | null;
  risk_probability: number;
  risk_band: string;
  computed_at: string;
}

export function RiskQueue({ orgSlug, rows }: { orgSlug: string; rows: RiskQueueRow[] }) {
  return (
    <DataTable
      rows={rows}
      rowKey={(row) => row.id}
      empty="No hay ordenes abiertas con riesgo alto."
      selectableLabel="evaluaciones"
      emptyAction={<Link href={`/${orgSlug}/accounts`} className="text-xs font-medium underline">Revisar sincronización →</Link>}
      columns={[
        {
          key: 'order',
          header: 'Orden',
          render: (row) =>
            row.order_id ? (
              <Link className="underline" href={`/${orgSlug}/orders/${row.order_id}`}>
                {row.order_id}
              </Link>
            ) : (
              '—'
            ),
        },
        {
          key: 'risk',
          header: 'Riesgo',
          exportValue: (row) => row.risk_probability * 100,
          render: (row) => <div className="min-w-40"><RiskScoreBadge score={row.risk_probability} band={row.risk_band} /><progress aria-label={`Score ${statusLabel(row.risk_band)}`} max={1} value={row.risk_probability} className="mt-2 block h-1.5 w-full" /></div>,
        },
        { key: 'computed', header: 'Calculado', exportValue: (row) => row.computed_at, render: (row) => formatDateTime(row.computed_at) },
      ]}
    />
  );
}
