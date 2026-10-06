'use client';

import { useState } from 'react';
import { SUPPORTED_SITES } from '@/lib/meli/site-config';

/** Starts the OAuth linking flow. The state and PKCE verifier stay server-side. */
export function ConnectAccountButton({ orgSlug }: { orgSlug: string }) {
  const [siteId, setSiteId] = useState<string>('MLA');
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function connect() {
    setPending(true);
    setError(null);

    try {
    const response = await fetch('/api/integrations/meli/connect', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ orgSlug, siteId }),
    });

    if (!response.ok) {
      setError('No pudimos iniciar la vinculacion.');
      setPending(false);
      return;
    }

    const payload = (await response.json()) as { url: string };
    window.location.href = payload.url;
    } catch {
      setError('No pudimos conectar con el servicio. Intentá nuevamente.');
      setPending(false);
    }
  }

  return (
    <div className="card flex flex-wrap items-center gap-4 p-5 sm:p-6">
      <div className="mr-auto"><p className="text-sm font-semibold">Conectá tu cuenta</p><p className="muted mt-1 text-xs">Vinculá Mercado Libre para reunir tu operación en sentinela.</p></div>
      <label className="text-sm">
        Sitio
        <select
          className="ml-2 rounded border px-3 py-2"
          value={siteId}
          onChange={(event) => setSiteId(event.target.value)}
        >
          {SUPPORTED_SITES.map((site) => (
            <option key={site} value={site}>
              {site}
            </option>
          ))}
        </select>
      </label>
      <button
        type="button"
        onClick={() => void connect()}
        disabled={pending}
        className="rounded-lg bg-black px-5 py-3 text-sm font-medium text-white hover:bg-neutral-800 disabled:opacity-50"
      >
        Vincular cuenta MercadoLibre
      </button>
      {error && <span className="text-sm text-red-600">{error}</span>}
    </div>
  );
}
