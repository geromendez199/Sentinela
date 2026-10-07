'use client';
export default function ErrorPage({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return <main className="mx-auto max-w-lg p-8"><h1 className="text-xl font-semibold">No pudimos cargar esta información</h1><p className="mt-3">Puede haber un problema de conexión o permisos. Intentá nuevamente. Si persiste, contactá al administrador.</p><button onClick={reset} className="mt-4 rounded border px-4 py-2">Reintentar</button></main>;
}
