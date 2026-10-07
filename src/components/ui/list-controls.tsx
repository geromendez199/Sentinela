'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { usePathname } from 'next/navigation';
import { statusLabel } from '@/lib/ui/labels';

const SORT_LABELS: Record<string, string> = { newest: 'Más recientes', oldest: 'Más antiguas', deadline: 'Vencimiento más próximo', priority: 'Severidad más alta' };

export function ListFilters({ q, status, statuses, placeholder, sort = 'newest', sorts = ['newest', 'oldest'], severity = '', withSeverity = false }: {
  q: string; status: string; statuses: readonly string[]; placeholder: string;
  sort?: string; sorts?: readonly string[]; severity?: string; withSeverity?: boolean;
}) {
  const pathname = usePathname();
  const [saved, setSaved] = useState('');
  const defaultSort = sorts[0];
  useEffect(() => {
    const storageKey = 'sentinela:filters:' + pathname;
    try {
      const params = new URLSearchParams({ ...(q ? { q } : {}), ...(status ? { status } : {}), ...(severity ? { severity } : {}), sort });
      const savedValue = sessionStorage.getItem(storageKey) ?? '';
      // URL is the source of truth; restoring a previous view is always explicit.
      if (q || status || severity || sort !== defaultSort) sessionStorage.setItem(storageKey, params.toString());
      else setSaved(savedValue);
    } catch { /* Private browsing can disable storage; URL filters still work. */ }
  }, [pathname, q, status, sort, severity, defaultSort]);
  const filtered = Boolean(q || status || severity || sort !== defaultSort);
  return <div className="mb-5 rounded-xl border bg-neutral-50/70 p-4">
    <form key={q + ':' + status + ':' + sort + ':' + severity} className="grid grid-cols-1 items-end gap-3 min-[480px]:grid-cols-2 sm:flex sm:flex-wrap" role="search" aria-label="Filtrar todos los registros">
      <label className="col-span-full w-full text-xs font-medium sm:min-w-[180px] sm:flex-1">Buscar en todos los registros<input type="search" name="q" defaultValue={q} placeholder={placeholder} maxLength={120} className="mt-2 w-full border px-3 py-2 text-sm" /></label>
      <label className="min-w-0 text-xs font-medium">Estado<select aria-label="Estado" name="status" defaultValue={status} className="mt-2 block w-full border px-3 py-2 text-sm"><option value="">Todos los estados</option>{statuses.map((value) => <option key={value} value={value}>{statusLabel(value)}</option>)}</select></label>
      {withSeverity && <label className="min-w-0 text-xs font-medium">Severidad<select aria-label="Severidad" name="severity" defaultValue={severity} className="mt-2 block w-full border px-3 py-2 text-sm"><option value="">Todas</option>{['critical', 'high', 'warning', 'info'].map((value) => <option key={value} value={value}>{statusLabel(value)}</option>)}</select></label>}
      <label className="min-w-0 text-xs font-medium">Ordenar<select aria-label="Ordenar" name="sort" defaultValue={sort} className="mt-2 block w-full border px-3 py-2 text-sm">{sorts.map((value) => <option key={value} value={value}>{SORT_LABELS[value] ?? value}</option>)}</select></label>
      <button className="min-h-10 rounded-lg bg-black px-4 text-sm text-white hover:bg-neutral-800">Aplicar</button>
      {filtered && <Link href={pathname} onClick={() => { try { sessionStorage.removeItem('sentinela:filters:' + pathname); } catch {} setSaved(''); }} className="py-2.5 text-xs underline">Limpiar filtros</Link>}
    </form>
    {!filtered && saved && <Link href={pathname + '?' + saved} className="mt-3 inline-block text-xs underline">Recuperar últimos filtros</Link>}
    {filtered && <p className="muted mt-3 text-[11px]">Vista filtrada. Los filtros se conservan al cambiar de página y podés compartir esta URL.</p>}
  </div>;
}

export function Pagination({ page, hasNext, q, status, sort, severity }: { page: number; hasNext: boolean; q: string; status: string; sort?: string; severity?: string }) {
  const href = (next: number) => '?' + new URLSearchParams({ page: String(next), ...(q ? { q } : {}), ...(status ? { status } : {}), ...(sort ? { sort } : {}), ...(severity ? { severity } : {}) });
  return <nav aria-label="Paginación" className="mt-5 flex flex-wrap items-center justify-between gap-3 text-xs"><span className="muted">Página {page} · hasta 25 registros</span><div className="flex gap-2">{page > 1 ? <Link href={href(page - 1)} className="rounded-lg border px-4 py-3 hover:bg-neutral-100">← Anterior</Link> : <span aria-disabled="true" className="rounded-lg border px-4 py-3 text-neutral-400">← Anterior</span>}{hasNext ? <Link href={href(page + 1)} className="rounded-lg border px-4 py-3 hover:bg-neutral-100">Siguiente →</Link> : <span aria-disabled="true" className="rounded-lg border px-4 py-3 text-neutral-400">Siguiente →</span>}</div></nav>;
}
