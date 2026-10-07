import { EmptyState } from './card';
import { SelectableTable } from './selectable-table';
import { isValidElement, type ReactNode } from 'react';

function nodeText(node: ReactNode): string {
  if (typeof node === 'string' || typeof node === 'number') return String(node);
  if (Array.isArray(node)) return node.map(nodeText).join(' ');
  if (isValidElement<{ children?: ReactNode }>(node)) return nodeText(node.props.children);
  return '';
}

export interface Column<Row> {
  key: string;
  header: string;
  render: (row: Row) => React.ReactNode;
  exportValue?: (row: Row) => string | number;
}

export function DataTable<Row>({
  rows,
  columns,
  empty,
  rowKey,
  selectableLabel,
  emptyAction,
  bulkAcknowledge,
  selectionScope,
}: {
  rows: Row[];
  columns: Array<Column<Row>>;
  empty: string;
  rowKey: (row: Row) => string;
  selectableLabel?: string;
  emptyAction?: React.ReactNode;
  bulkAcknowledge?: { orgSlug: string };
  selectionScope?: string;
}) {
  if (rows.length === 0) return <EmptyState message={empty} action={emptyAction} />;

  return (
      <SelectableTable
        key={selectionScope ?? JSON.stringify(rows.map(rowKey))}
        label={selectableLabel ?? 'resultados'}
        selectable={Boolean(selectableLabel)}
        bulkAcknowledge={bulkAcknowledge}
        headers={columns.map((column) => column.header)}
        rows={rows.map((row) => ({
          key: rowKey(row),
          cells: columns.map((column) => column.render(row)),
          values: columns.map((column) => column.exportValue?.(row) ?? nodeText(column.render(row))),
        }))}
      />
    );
}
