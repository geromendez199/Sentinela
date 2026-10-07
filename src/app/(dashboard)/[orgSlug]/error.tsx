'use client';

import { useEffect } from 'react';

export default function DashboardError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error('dashboard_section_failed', { digest: error.digest, name: error.name });
  }, [error]);

  return (
    <section role="alert" className="mx-auto my-12 max-w-2xl rounded-2xl border border-neutral-300 bg-white p-8 shadow-sm">
      <p className="text-xs font-semibold uppercase tracking-[0.18em] text-neutral-500">Sentinela · Recuperación segura</p>
      <h1 className="mt-3 text-2xl font-semibold tracking-tight text-black">Esta sección no pudo cargar</h1>
      <p className="mt-3 max-w-xl text-sm leading-6 text-neutral-600">
        Tus datos y el resto del panel siguen disponibles. Reintentá la carga de esta sección; si el problema continúa, usá el identificador de diagnóstico del pie.
      </p>
      <div className="mt-6 flex flex-wrap items-center gap-3">
        <button type="button" onClick={reset} className="rounded-lg bg-black px-4 py-2.5 text-sm font-semibold text-white hover:bg-neutral-800 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-black">
          Reintentar
        </button>
        {error.digest && <span className="font-mono text-xs text-neutral-500">Diagnóstico {error.digest}</span>}
      </div>
    </section>
  );
}
