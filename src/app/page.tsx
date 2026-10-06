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
    <main className="mx-auto max-w-3xl px-6 py-16">
      <h1 className="text-3xl font-semibold">Sentinela ML</h1>
      <p className="muted mt-3 text-sm">
        Observa la verdad oficial, reconstruye el estado reputacional, estima riesgo por venta,
        sugiere una intervencion segura y mide el resultado.
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
        <section className="mt-8">
          <Link href="/organizations/new" className="mb-4 inline-block rounded bg-slate-900 px-4 py-2 text-white">Crear organización</Link>
          <h2 className="text-sm font-medium uppercase tracking-wide muted">Organizaciones</h2>
          <ul className="mt-3 space-y-2">
            {organizations.map((org) => (
              <li key={org.id}>
                <Link className="card block px-4 py-3 text-sm" href={`/${org.slug}/overview`}>
                  {org.name}
                </Link>
              </li>
            ))}
            {organizations.length === 0 && (
              <li className="muted text-sm">
                Todavia no perteneces a ninguna organizacion.
              </li>
            )}
          </ul>
        </section>
      )}
    </main>
  );
}
