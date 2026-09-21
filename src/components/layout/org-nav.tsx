import Link from 'next/link';

const SECTIONS: Array<{ href: string; label: string }> = [
  { href: 'overview', label: 'Resumen' },
  { href: 'reputation', label: 'Reputacion' },
  { href: 'risk', label: 'Riesgo' },
  { href: 'orders', label: 'Ordenes' },
  { href: 'claims', label: 'Reclamos' },
  { href: 'listings', label: 'Publicaciones' },
  { href: 'root-causes', label: 'Causa raiz' },
  { href: 'playbooks', label: 'Playbooks' },
  { href: 'actions', label: 'Acciones' },
  { href: 'alerts', label: 'Alertas' },
  { href: 'accounts', label: 'Cuentas' },
  { href: 'settings', label: 'Configuracion' },
];

export function OrgNav({ orgSlug }: { orgSlug: string }) {
  return (
    <nav className="flex flex-wrap gap-1 border-b px-4 py-2 text-sm">
      {SECTIONS.map((section) => (
        <Link
          key={section.href}
          className="rounded px-3 py-1 hover:bg-slate-100 dark:hover:bg-slate-800"
          href={`/${orgSlug}/${section.href}`}
        >
          {section.label}
        </Link>
      ))}
    </nav>
  );
}
