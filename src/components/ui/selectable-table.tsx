'use client';

import type { ReactNode } from 'react';
import { useMemo, useRef, useEffect, useState } from 'react';
import { compareCells, makeCsv } from '@/lib/ui/table-data';
import { useToast } from './toast-provider';
import { useRouter } from 'next/navigation';

export interface SelectableRow { key: string; cells: ReactNode[]; values: Array<string | number> }

export function SelectableTable({ headers, rows, label, selectable = true, bulkAcknowledge }: { headers: string[]; rows: SelectableRow[]; label: string; selectable?: boolean; bulkAcknowledge?: { orgSlug: string } }) {
  const [selected, setSelected] = useState<Set<string>>(() => new Set());
  const [search, setSearch] = useState('');
  const [sort, setSort] = useState<{ column: number; ascending: boolean } | null>(null);
  const [compact, setCompact] = useState(false);
  const checkbox = useRef<HTMLInputElement>(null);
  const notify = useToast();
  const router = useRouter();
  const [processing, setProcessing] = useState(false);
  const visible = useMemo(() => {
    const normalize = (value: string) => value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
    const matches = rows.filter((row) => normalize(row.key + ' ' + row.values.join(' ')).includes(normalize(search)));
    return sort ? [...matches].sort((a, b) => compareCells(a.values[sort.column] ?? '', b.values[sort.column] ?? '') * (sort.ascending ? 1 : -1)) : matches;
  }, [rows, search, sort]);
  const selectedRows = rows.filter((row) => selected.has(row.key));
  const rowIdentity = JSON.stringify(rows.map(row => row.key));
  useEffect(() => {
    const available = new Set<string>(JSON.parse(rowIdentity));
    setSelected(current => {
      const retained = new Set([...current].filter(id => available.has(id)));
      return retained.size === current.size ? current : retained;
    });
  }, [rowIdentity]);
  const selectedVisible = visible.filter((row) => selected.has(row.key)).length;
  const allSelected = visible.length > 0 && selectedVisible === visible.length;
  useEffect(() => { if (checkbox.current) checkbox.current.indeterminate = selectedVisible > 0 && !allSelected; }, [selectedVisible, allSelected]);

  function toggleAll() {
    setSelected((current) => {
      const next = new Set(current);
      visible.forEach((row) => allSelected ? next.delete(row.key) : next.add(row.key));
      return next;
    });
  }
  function toggleOne(key: string) {
    setSelected((current) => { const next = new Set(current); if (next.has(key)) next.delete(key); else next.add(key); return next; });
  }
  async function copyIds() {
    try { await navigator.clipboard.writeText(selectedRows.map((row) => row.key).join('\n')); notify('Identificadores copiados.'); }
    catch { notify('No se pudo copiar. Usá Exportar selección para descargar los datos.', 'error'); }
  }
  function exportCsv() {
    const exported = selectedRows.length > 0 ? selectedRows : visible;
    const csv = makeCsv(['ID', ...headers], exported.map((row) => [row.key, ...row.values]));
    const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }));
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = 'sentinela-' + label + '-' + new Date().toISOString().slice(0, 10) + '.csv';
    anchor.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    notify(exported.length + ' registros exportados con todas sus columnas.');
  }
  async function acknowledgeSelection() {
    if (processing) return;
    setProcessing(true);
    const ids = selectedRows.map((row) => row.key);
    const failed: string[] = [];
    for (let index = 0; index < ids.length; index += 5) {
      await Promise.all(ids.slice(index, index + 5).map(async (id) => {
        try {
          const response = await fetch('/api/alerts/' + encodeURIComponent(id) + '/ack', { method: 'POST', headers: { 'Content-Type': 'application/json', 'Idempotency-Key': crypto.randomUUID() }, body: JSON.stringify(bulkAcknowledge) });
          if (!response.ok) failed.push(id);
        } catch { failed.push(id); }
      }));
    }
    setSelected(new Set(failed));
    setProcessing(false);
    const completed = ids.length - failed.length;
    notify(failed.length ? completed + ' alertas marcadas. ' + failed.length + ' pendientes; podés reintentar la selección.' : completed + ' alertas marcadas como vistas.', failed.length ? 'error' : 'success');
    router.refresh();
  }

  return <div className="overflow-hidden rounded-xl border border-neutral-200 bg-white">
    <div className="flex flex-wrap items-center justify-between gap-3 border-b bg-neutral-50 p-3">
      <label className="flex-1 text-xs font-medium"><span className="sr-only">Buscar en esta página</span><input type="search" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Buscar en esta página…" className="w-full min-w-40 border px-3 py-2 text-xs sm:max-w-xs" /></label>
      <div className="flex flex-wrap gap-2">
        {bulkAcknowledge && <button type="button" disabled={processing || !selectedRows.length} onClick={() => void acknowledgeSelection()} className="min-h-10 rounded-lg border bg-white px-3 text-xs hover:bg-neutral-100 disabled:opacity-40">{processing ? 'Guardando selección…' : 'Marcar selección como vista'}</button>}
        <button type="button" aria-pressed={compact} onClick={() => setCompact(!compact)} className="min-h-10 rounded-lg border bg-white px-3 text-xs hover:bg-neutral-100">{compact ? 'Vista cómoda' : 'Vista compacta'}</button>
        {selectable && <button type="button" disabled={!selectedRows.length} onClick={() => void copyIds()} className="min-h-10 rounded-lg border bg-white px-3 text-xs hover:bg-neutral-100 disabled:opacity-40">Copiar IDs</button>}
        <button type="button" disabled={!visible.length && !selectedRows.length} onClick={exportCsv} className="min-h-10 rounded-lg bg-black px-3 text-xs font-medium text-white hover:bg-neutral-800 disabled:opacity-40">{selectedRows.length ? 'Exportar selección' : 'Exportar visibles'}</button>
      </div>
    </div>
    <div className="flex flex-wrap items-center justify-between gap-2 border-b px-4 py-2 text-[11px] text-neutral-600">
      <span role="status">{visible.length} de {rows.length} registros de esta página{selectedRows.length > 0 ? ' · ' + selectedRows.length + ' seleccionados' : ''}</span>
      {selectedRows.length > 0 ? <button type="button" disabled={processing} onClick={() => setSelected(new Set())} className="min-h-8 underline disabled:opacity-40">Limpiar selección</button> : <span>Ordená esta página desde los encabezados ↕</span>}
    </div>
    <div className="overflow-x-auto" role="region" aria-label={'Tabla de ' + label} tabIndex={0}>
      <table className={'w-full text-left text-sm ' + (compact ? '[&_td]:py-2' : '[&_td]:py-3.5')}>
        <caption className="sr-only">{label}. Los encabezados permiten ordenar los registros de la página actual.</caption>
        <thead className="bg-neutral-50 text-[10px] uppercase tracking-wider text-neutral-600"><tr>
          {selectable && <th scope="col" className="w-12 px-4 py-2"><input ref={checkbox} type="checkbox" checked={allSelected} disabled={processing || !visible.length} onChange={toggleAll} aria-label={'Seleccionar todos los registros visibles de ' + label} className="size-4" /></th>}
          {headers.map((header, index) => <th key={header} scope="col" aria-sort={sort?.column === index ? (sort.ascending ? 'ascending' : 'descending') : 'none'} className="px-4 py-2"><button type="button" onClick={() => setSort({ column: index, ascending: sort?.column === index ? !sort.ascending : true })} className="min-h-10 text-left font-semibold uppercase hover:text-black">{header} <span aria-hidden="true">{sort?.column === index ? (sort.ascending ? '↑' : '↓') : '↕'}</span></button></th>)}
        </tr></thead>
        <tbody>{visible.map((row) => <tr key={row.key} className={'border-t transition-colors ' + (selected.has(row.key) ? 'bg-neutral-100' : 'hover:bg-neutral-50')}>
          {selectable && <td className="px-4"><input type="checkbox" disabled={processing} checked={selected.has(row.key)} onChange={() => toggleOne(row.key)} aria-label={'Seleccionar ' + row.key} className="size-4" /></td>}
          {row.cells.map((cell, index) => <td key={index} className="px-4">{cell}</td>)}
        </tr>)}</tbody>
      </table>
      {!visible.length && <p role="status" className="muted p-8 text-center text-sm">Sin resultados en esta página. <button type="button" className="underline" onClick={() => setSearch('')}>Limpiar búsqueda</button></p>}
    </div>
  </div>;
}
