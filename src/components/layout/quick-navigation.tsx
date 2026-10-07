'use client';

import Link from 'next/link';
import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { SECTIONS } from './org-nav';

const normalize = (value: string) => value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();

export function QuickNavigation({ orgSlug }: { orgSlug: string }) {
  const dialog = useRef<HTMLDialogElement>(null);
  const input = useRef<HTMLInputElement>(null);
  const [query, setQuery] = useState('');
  const router = useRouter();
  const matches = SECTIONS.filter((section) => normalize(section.label + ' ' + section.description).includes(normalize(query)));
  function open() { setQuery(''); dialog.current?.showModal(); input.current?.focus(); }
  useEffect(() => {
    const key = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k') {
        event.preventDefault();
        if (dialog.current?.open) dialog.current.close();
        else { setQuery(''); dialog.current?.showModal(); input.current?.focus(); }
      }
    };
    document.addEventListener('keydown', key);
    return () => document.removeEventListener('keydown', key);
  }, []);
  return <>
    <button type="button" onClick={open} className="flex min-h-10 items-center gap-2 rounded-lg border px-3 text-xs hover:bg-neutral-100" aria-haspopup="dialog"><span aria-hidden="true">⌕</span> Buscar <kbd className="muted hidden rounded border px-1.5 py-0.5 sm:inline">⌘ / Ctrl K</kbd></button>
    <dialog ref={dialog} aria-labelledby="navigation-search-title" onClick={(event) => { if (event.target === event.currentTarget) dialog.current?.close(); }} className="fixed inset-0 m-auto w-[calc(100%-32px)] max-w-lg rounded-2xl border bg-white p-5 text-neutral-900 shadow-2xl backdrop:bg-black/50">
      <div className="mb-4 flex items-center justify-between"><h2 id="navigation-search-title" className="font-semibold">Ir a una sección</h2><button type="button" onClick={() => dialog.current?.close()} className="rounded border px-3 py-2 text-xs hover:bg-neutral-100">Cerrar <kbd>Esc</kbd></button></div>
      <form onSubmit={(event) => { event.preventDefault(); if (matches[0]) { dialog.current?.close(); router.push('/' + orgSlug + '/' + matches[0].href); } }}>
        <input ref={input} aria-label="Buscar sección" value={query} onChange={(event) => setQuery(event.target.value)} className="mb-4 w-full border px-3 py-3 text-sm" placeholder="Órdenes, cuentas, alertas…" />
      </form>
      <ul className="max-h-[50vh] space-y-1 overflow-y-auto">{matches.map((section) => <li key={section.href}><Link onClick={() => dialog.current?.close()} href={'/' + orgSlug + '/' + section.href} className="block rounded-lg px-3 py-3 hover:bg-neutral-100"><span className="text-sm font-medium">{section.label}</span><p className="muted mt-1 text-xs">{section.description}</p></Link></li>)}</ul>
      {!matches.length && <p role="status" className="muted py-4 text-sm">Sin resultados. Probá con «órdenes» o «cuentas».</p>}
      <p className="muted mt-4 border-t pt-3 text-[11px]">Tab para recorrer · Enter para abrir · Esc para cerrar</p>
    </dialog>
  </>;
}
