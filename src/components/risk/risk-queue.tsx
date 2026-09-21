import Link from 'next/link';
import { DataTable } from '@/components/ui/data-table';
import { RiskScoreBadge } from './risk-score-badge';
import { formatDateTime } from '@/lib/utils/format';

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
          render: (row) => <RiskScoreBadge score={row.risk_probability} band={row.risk_band} />,
        },
        { key: 'computed', header: 'Calculado', render: (row) => formatDateTime(row.computed_at) },
      ]}
    />
  );
}
