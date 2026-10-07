'use client';
import Link from 'next/link';
import { useEffect, useRef, useState } from 'react';
import { SECTIONS } from './org-nav';
export function QuickNavigation({orgSlug}: {orgSlug: string}) {
 const dialog=useRef<HTMLDialogElement>(null);const [query,setQuery]=useState('');
 const open=()=>{setQuery('');dialog.current?.showModal();};
 const inputRef=useRef<HTMLInputElement>(null);
 useEffect(()=>{const key=(event:KeyboardEvent)=>{if((event.metaKey||event.ctrlKey)&&event.key.toLowerCase()==='k'){event.preventDefault();setQuery('');if(dialog.current?.open)dialog.current.close();else dialog.current?.showModal();}};document.addEventListener('keydown',key);return()=>document.removeEventListener('keydown',key);},[]);
 useEffect(()=>{if(dialog.current?.open) inputRef.current?.focus();},[query]);
 const normalize=(value:string)=>value.normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase();
 const matches=SECTIONS.filter(section=>normalize(section.label).includes(normalize(query)));
 return <><button onClick={open} className="rounded-lg border px-3 py-2 text-xs hover:bg-neutral-100" aria-label="Buscar una sección">Buscar <kbd className="muted ml-2 hidden sm:inline">Ctrl K</kbd></button><dialog ref={dialog} aria-labelledby="navigation-search-title" className="fixed inset-0 m-auto w-[calc(100%-32px)] max-w-lg rounded-2xl border bg-white p-5 text-neutral-900 shadow-2xl backdrop:bg-black/50"><div className="mb-4 flex items-center justify-between"><h2 id="navigation-search-title" className="font-semibold">Ir a una sección</h2><button onClick={()=>dialog.current?.close()} className="rounded border px-2 py-1 text-xs hover:bg-neutral-100">Cerrar</button></div><input ref={inputRef} aria-label="Buscar sección" value={query} onChange={event=>setQuery(event.target.value)} className="mb-4 w-full border px-3 py-2 text-sm" placeholder="Órdenes, cuentas, alertas…" /><ul className="max-h-[50vh] overflow-y-auto">{matches.map(section=><li key={section.href}><Link onClick={()=>dialog.current?.close()} href={`/${orgSlug}/${section.href}`} className="block rounded-lg px-3 py-3 text-sm hover:bg-neutral-100">{section.label}<span className="muted float-right" aria-hidden="true">↗</span></Link></li>)}</ul>{!matches.length&&<p role="status" className="muted py-4 text-sm">No encontramos esa sección.</p>}</dialog></>;
}
