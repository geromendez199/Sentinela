'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

export default function ResourceNotFound() {
  const orgSlug = usePathname().split('/')[1];
  return <section className="card mx-auto max-w-xl p-8 text-center"><p className="page-eyebrow">Recurso no disponible</p><h2 className="mt-3 text-2xl font-semibold">No encontramos este registro</h2><p className="muted mt-3 text-sm leading-relaxed">Puede que todavía no se haya sincronizado o que ya no esté disponible en este espacio.</p><Link href={'/' + orgSlug + '/overview'} className="mt-6 inline-flex min-h-11 items-center rounded-lg bg-black px-5 text-sm text-white">Volver al resumen</Link></section>;
}
