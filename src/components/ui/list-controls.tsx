import Link from 'next/link';
export function ListFilters({ q, status, statuses, placeholder }: { q: string; status: string; statuses: readonly string[]; placeholder: string }) {
  return <form key={`${q}:${status}`} className="mb-5 flex flex-wrap items-end gap-3" role="search">
    <label className="w-full text-xs font-medium sm:min-w-[180px] sm:flex-1">Buscar<input type="search" name="q" defaultValue={q} placeholder={placeholder} maxLength={120} className="mt-2 w-full border px-3 py-2 text-sm" /></label>
    <label className="text-xs font-medium">Estado<select name="status" defaultValue={status} className="mt-2 block border px-3 py-2 text-sm"><option value="">Todos los estados</option>{statuses.map(value => <option key={value} value={value}>{value}</option>)}</select></label>
    <button className="rounded-lg bg-black px-4 py-2.5 text-sm text-white">Filtrar</button>
    {(q || status) && <Link href="?" className="py-2.5 text-xs underline">Limpiar</Link>}
  </form>;
}
export function Pagination({ page, hasNext, q, status }: { page: number; hasNext: boolean; q: string; status: string }) {
  const href = (next: number) => `?${new URLSearchParams({page:String(next), ...(q ? {q} : {}), ...(status ? {status} : {})})}`;
  return <nav aria-label="Paginación" className="mt-5 flex flex-wrap items-center justify-between gap-3 text-xs"><span className="muted">Página {page} · hasta 25 registros</span><div className="flex gap-3">{page > 1 && <Link href={href(page-1)} className="rounded-lg border px-4 py-2">← Anterior</Link>}{hasNext && <Link href={href(page+1)} className="rounded-lg border px-4 py-2">Siguiente →</Link>}</div></nav>;
}
