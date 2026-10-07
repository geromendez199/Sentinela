'use client';

import type { ReactNode } from 'react';
import { useMemo, useState } from 'react';

export interface SelectableRow {
  key: string;
  cells: ReactNode[];
}

export function SelectableTable({
  headers,
  rows,
  label,
}: {
  headers: string[];
  rows: SelectableRow[];
  label: string;
}) {
  const [selected, setSelected] = useState<Set<string>>(() => new Set());
  const selectedIds = useMemo(() => rows.filter((row) => selected.has(row.key)).map((row) => row.key), [rows, selected]);
  const allSelected = rows.length > 0 && selected.size === rows.length;

  function toggleAll(): void {
    setSelected(allSelected ? new Set() : new Set(rows.map((row) => row.key)));
  }

  function toggleOne(key: string): void {
    setSelected((current) => {
      const next = new Set(current);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }

  async function copyIds(): Promise<void> {
    await navigator.clipboard.writeText(selectedIds.join('\n'));
  }

  function exportCsv(): void {
    const csv = ['id', ...selectedIds].map((value) => `"${value.replaceAll('"', '""')}"`).join('\n');
    const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }));
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = `sentinela-${label}-${new Date().toISOString().slice(0, 10)}.csv`;
    anchor.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="overflow-hidden rounded-xl border border-neutral-200 bg-white">
      <div className="flex min-h-14 flex-wrap items-center justify-between gap-3 border-b border-neutral-200 bg-neutral-50 px-4 py-2.5">
        <p className="text-xs font-medium text-neutral-600" aria-live="polite">
          {selected.size === 0 ? `Seleccioná ${label} para operar en lote` : `${selected.size} ${label} seleccionadas`}
        </p>
        <div className="flex gap-2">
          <button type="button" disabled={selected.size === 0} onClick={() => void copyIds()} className="rounded-lg border border-neutral-300 bg-white px-3 py-2 text-xs font-medium hover:bg-neutral-100 disabled:cursor-not-allowed disabled:opacity-40">
            Copiar IDs
          </button>
          <button type="button" disabled={selected.size === 0} onClick={exportCsv} className="rounded-lg bg-black px-3 py-2 text-xs font-medium text-white hover:bg-neutral-800 disabled:cursor-not-allowed disabled:opacity-40">
            Exportar selección
          </button>
        </div>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-left text-sm">
          <thead className="bg-neutral-50 text-[10px] uppercase tracking-wider text-neutral-500">
            <tr>
              <th className="w-12 px-4 py-3.5">
                <input type="checkbox" checked={allSelected} onChange={toggleAll} aria-label={`Seleccionar todas las ${label}`} className="size-4 accent-black" />
              </th>
              {headers.map((header) => <th key={header} className="px-4 py-3.5 font-semibold">{header}</th>)}
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => {
              const checked = selected.has(row.key);
              return (
                <tr key={row.key} className={`border-t transition-colors ${checked ? 'bg-neutral-100' : 'hover:bg-neutral-50'}`}>
                  <td className="px-4 py-4">
                    <input type="checkbox" checked={checked} onChange={() => toggleOne(row.key)} aria-label={`Seleccionar ${row.key}`} className="size-4 accent-black" />
                  </td>
                  {row.cells.map((cell, index) => <td key={`${row.key}-${headers[index] ?? index}`} className="px-4 py-4">{cell}</td>)}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
