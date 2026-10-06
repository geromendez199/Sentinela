import { BrandLogo } from '@/components/brand/brand-logo';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/server';
import { listUserOrganizations } from '@/lib/auth/org-context';

export default async function HomePage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const organizations = user ? await listUserOrganizations() : [];

  return (
    <main className="mx-auto max-w-4xl px-6 py-12 sm:py-20">
      <div className="mb-12"><BrandLogo /></div>
      <p className="page-eyebrow mb-3">Tu operación, en perspectiva</p>
      <h1 className="max-w-2xl text-4xl font-semibold leading-tight tracking-tight sm:text-5xl">Más claridad.
        <span className="block text-neutral-500">Mejores decisiones.</span>
      </h1>
      <p className="muted mt-5 max-w-xl text-base leading-relaxed">
        Reuní tu operación de Mercado Libre, entendé las señales de reputación y revisá dónde intervenir.
      </p>

      {!user ? (
        <div className="mt-8 flex gap-3">
          <Link className="rounded-md bg-slate-900 px-4 py-2 text-sm text-white" href="/login">
            Iniciar sesion
          </Link>
          <Link className="rounded-md border px-4 py-2 text-sm" href="/signup">
            Crear cuenta
          </Link>
        </div>
      ) : (
        <section className="mt-12">
          <Link href="/organizations/new" className="mb-8 inline-block rounded-lg bg-black px-5 py-3 text-sm font-medium text-white hover:bg-neutral-800">Crear organización</Link>
          <h2 className="page-eyebrow">Organizaciones</h2>
          <ul className="mt-4 grid gap-4 sm:grid-cols-2">
            {organizations.map((org) => (
              <li key={org.id}>
                <Link className="card flex items-center justify-between px-6 py-6 text-sm font-semibold" href={`/${org.slug}/overview`}>
                  {org.name}<span aria-hidden="true" className="muted text-lg">→</span>
                </Link>
              </li>
            ))}
            {organizations.length === 0 && (
              <li className="muted text-sm">
                Creá tu primera organización para empezar a conectar tus cuentas.
              </li>
            )}
          </ul>
        </section>
      )}
    </main>
  );
}
