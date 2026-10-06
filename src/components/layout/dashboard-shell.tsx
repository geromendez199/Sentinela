import Link from 'next/link';
import { BrandLogo } from '@/components/brand/brand-logo';
import { OrgNav, PageHeading } from '@/components/layout/org-nav';

const ROLE_LABELS: Record<string, string> = { owner: 'Propietario', admin: 'Administrador', operator: 'Operador', viewer: 'Observador' };

export function DashboardShell({ children, orgSlug, orgName, role }: { children: React.ReactNode; orgSlug: string; orgName: string; role: string }) {
  return (
    <div className="min-h-screen lg:pl-[240px]">
      <a href="#main-content" className="fixed left-4 top-4 z-50 -translate-y-24 rounded bg-white px-4 py-3 text-black focus:translate-y-0">Ir al contenido</a>
      <aside className="lg:fixed lg:inset-y-0 lg:left-0 lg:flex lg:w-[240px] lg:flex-col lg:overflow-y-auto lg:bg-black">
        <Link href={`/${orgSlug}/overview`} className="flex items-center justify-center bg-black py-4 lg:justify-start lg:px-5 lg:py-7"><BrandLogo /></Link>
        <OrgNav orgSlug={orgSlug} />
        <div className="mt-auto hidden px-7 pb-7 pt-8 text-xs leading-relaxed text-neutral-500 lg:block">Observá. Entendé. Decidí.<br /><span className="text-[10px]">sentinela · beta</span></div>
      </aside>
      <header className="flex min-h-20 items-center justify-between gap-3 border-b bg-white px-5 lg:px-10">
        <div className="min-w-0"><p className="page-eyebrow mb-1">Espacio de trabajo</p><p className="truncate text-sm font-semibold">{orgName}</p></div>
        <div className="flex items-center gap-3"><span className="muted hidden text-xs sm:inline">{ROLE_LABELS[role] ?? role}</span><span className="flex h-9 w-9 items-center justify-center rounded-full border bg-neutral-50 text-xs font-semibold" aria-label={ROLE_LABELS[role] ?? role}>{orgName.slice(0, 2).toUpperCase()}</span></div>
      </header>
      <main id="main-content" className="dashboard-content"><PageHeading orgSlug={orgSlug} />{children}</main>
    </div>
  );
}
