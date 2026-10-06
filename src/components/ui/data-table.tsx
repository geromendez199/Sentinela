import { EmptyState } from './card';

export interface Column<Row> {
  key: string;
  header: string;
  render: (row: Row) => React.ReactNode;
}

export function DataTable<Row>({
  rows,
  columns,
  empty,
  rowKey,
}: {
  rows: Row[];
  columns: Array<Column<Row>>;
  empty: string;
  rowKey: (row: Row) => string;
}) {
  if (rows.length === 0) return <EmptyState message={empty} />;

  return (
    <div className="overflow-x-auto rounded-xl border">
      <table className="w-full text-left text-sm">
        <thead className="bg-neutral-50 text-[10px] uppercase tracking-wider text-neutral-500">
          <tr>
            {columns.map((column) => (
              <th key={column.key} className="px-4 py-3.5 font-semibold">
                {column.header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={rowKey(row)} className="border-t transition-colors hover:bg-neutral-50">
              {columns.map((column) => (
                <td key={column.key} className="px-4 py-4">
                  {column.render(row)}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
