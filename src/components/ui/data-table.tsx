import { EmptyState } from './card';
import { SelectableTable } from './selectable-table';

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
  selectableLabel,
}: {
  rows: Row[];
  columns: Array<Column<Row>>;
  empty: string;
  rowKey: (row: Row) => string;
  selectableLabel?: string;
}) {
  if (rows.length === 0) return <EmptyState message={empty} />;

  if (selectableLabel) {
    return (
      <SelectableTable
        label={selectableLabel}
        headers={columns.map((column) => column.header)}
        rows={rows.map((row) => ({
          key: rowKey(row),
          cells: columns.map((column) => column.render(row)),
        }))}
      />
    );
  }

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
