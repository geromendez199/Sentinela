'use client';

import Link from 'next/link';
import { useEffect, useRef } from 'react';
import { usePathname } from 'next/navigation';

export const SECTIONS = [
  { href: 'overview', label: 'Resumen', group: 'OPERACIÓN', icon: 'M3 3h7v7H3z M14 3h7v7h-7z M3 14h7v7H3z M14 14h7v7h-7z', description: 'Una mirada clara sobre tu operación en Mercado Libre.' },
  { href: 'reputation', label: 'Reputación', group: '', icon: 'M12 3l8 4v5c0 5-8 9-8 9s-8-4-8-9V7z M8 12l3 3 5-6', description: 'La reputación oficial y las señales que la explican.' },
  { href: 'risk', label: 'Riesgo', group: '', icon: 'M3 18l6-6 4 3 8-11 M16 4h5v5', description: 'Detectá señales de riesgo y ordená tus prioridades.' },
  { href: 'orders', label: 'Órdenes', group: '', icon: 'M5 4h14v17H5z M8 9h8 M8 13h8 M8 17h5', description: 'El detalle de tus ventas, en un solo lugar.' },
  { href: 'claims', label: 'Reclamos', group: '', icon: 'M4 4h16v12H9l-5 4z M8 8h8 M8 12h5', description: 'Seguí cada reclamo y su estado actual.' },
  { href: 'listings', label: 'Publicaciones', group: '', icon: 'M3 7l9-4 9 4v13H3z M3 7l9 4 9-4 M12 11v9', description: 'Tus publicaciones y las señales de cada producto.' },
  { href: 'root-causes', label: 'Causa raíz', group: 'DECISIONES', icon: 'M12 3v6 M5 21v-6h14v6 M12 9v12 M3 21h4 M10 21h4 M17 21h4 M10 3h4', description: 'Explorá patrones para entender qué está pasando.' },
  { href: 'playbooks', label: 'Playbooks', group: '', icon: 'M5 3h14v18H5z M9 7h6 M9 11h6 M9 15h4', description: 'Reglas y respuestas para acompañar tu operación.' },
  { href: 'actions', label: 'Acciones', group: '', icon: 'M4 7l2 2 3-4 M12 7h8 M4 17l2 2 3-4 M12 17h8', description: 'Revisá las propuestas antes de tomar una decisión.' },
  { href: 'alerts', label: 'Alertas', group: '', icon: 'M6 9a6 6 0 0112 0v6l2 3H4l2-3z M10 21h4', description: 'Las novedades que necesitan tu atención.' },
  { href: 'accounts', label: 'Cuentas', group: 'ESPACIO DE TRABAJO', icon: 'M8 8a4 4 0 118 0 4 4 0 01-8 0 M4 21v-3a8 8 0 0116 0v3', description: 'Administrá tus conexiones con Mercado Libre.' },
  { href: 'settings', label: 'Configuración', group: '', icon: 'M4 7h16 M4 17h16 M8 4v6 M16 14v6', description: 'Los miembros, las integraciones y las preferencias de tu organización.' },
];

function currentSection(pathname: string, orgSlug: string) {
  return SECTIONS.find((section) => pathname === `/${orgSlug}/${section.href}` || pathname.startsWith(`/${orgSlug}/${section.href}/`));
}

export function PageHeading({ orgSlug }: { orgSlug: string }) {
  const section = currentSection(usePathname(), orgSlug);
  return (
    <div className="mb-7 flex flex-wrap items-end justify-between gap-4">
      <div>
        <p className="page-eyebrow mb-2">Tu operación, en perspectiva</p>
        <h1 className="text-3xl font-semibold tracking-tight">{section?.label ?? 'Tu organización'}</h1>
        <p className="muted mt-2 max-w-2xl text-sm leading-relaxed">{section?.description}</p>
      </div>
      <span className="rounded-full border bg-white px-3 py-1.5 text-[11px] font-medium tracking-wide">BETA</span>
    </div>
  );
}

export function OrgNav({ orgSlug }: { orgSlug: string }) {
  const active = currentSection(usePathname(), orgSlug)?.href;
  const navRef = useRef<HTMLElement>(null);
  useEffect(() => {
    if (window.matchMedia('(max-width: 1023px)').matches) {
      navRef.current?.querySelector('[aria-current="page"]')?.scrollIntoView({ block: 'nearest', inline: 'nearest' });
    }
  }, [active]);
  return (
    <nav ref={navRef} aria-label="Navegación de la organización" className="flex gap-1 overflow-x-auto border-b bg-white px-3 py-3 lg:block lg:space-y-1 lg:overflow-visible lg:border-0 lg:bg-transparent lg:px-4 lg:py-2">
      {SECTIONS.map((section) => (
        <div key={section.href} className="shrink-0">
          {section.group && <p className="mb-3 mt-6 hidden px-3 text-[9px] font-semibold tracking-[.15em] text-neutral-500 lg:block">{section.group}</p>}
          <Link aria-current={active === section.href ? 'page' : undefined} className={`flex items-center gap-3 whitespace-nowrap rounded-lg px-3 py-2.5 text-[13px] font-medium ${active === section.href ? 'bg-black text-white lg:bg-white lg:text-black' : 'text-neutral-600 hover:bg-neutral-100 hover:text-black lg:text-neutral-400 lg:hover:bg-neutral-900 lg:hover:text-white'}`} href={`/${orgSlug}/${section.href}`}>
            <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d={section.icon} /></svg>
            {section.label}
          </Link>
        </div>
      ))}
    </nav>
  );
}
