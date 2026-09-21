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
    <div className="overflow-x-auto">
      <table className="w-full text-left text-sm">
        <thead className="muted text-xs uppercase">
          <tr>
            {columns.map((column) => (
              <th key={column.key} className="px-2 py-2 font-medium">
                {column.header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={rowKey(row)} className="border-t">
              {columns.map((column) => (
                <td key={column.key} className="px-2 py-2">
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
