'use client';

import Link from 'next/link';
import { safeRedirectPath } from '@/lib/auth/safe-redirect';
import { BrandLogo } from '@/components/brand/brand-logo';

import { Suspense, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';

function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function onSubmit(event: React.FormEvent) {
    event.preventDefault();
    setPending(true);
    setError(null);

    try {
    const supabase = createClient();
    const { error: signInError } = await supabase.auth.signInWithPassword({ email, password });

    if (signInError) {
      // Never echo the provider message: it distinguishes existing accounts.
      setError('No pudimos iniciar sesion con esas credenciales.');
      setPending(false);
      return;
    }

    router.replace(safeRedirectPath(searchParams.get('next')));
    router.refresh();
    } catch { setError('No pudimos conectar. Intentá nuevamente.'); }
    finally { setPending(false); }
  }

  return (
    <main className="card mx-auto my-10 flex w-[calc(100%-32px)] max-w-md flex-col px-7 py-10 sm:my-20 sm:px-10">
      <div className="mb-8"><BrandLogo /></div>
      <h1 className="text-2xl font-semibold tracking-tight">Iniciar sesión</h1>
      <p className="muted mt-2 text-sm leading-relaxed">Volvé a tu espacio de trabajo.</p>
      {searchParams.get('error') && <p role="alert" className="mt-4 text-sm">El enlace de acceso no es válido o venció. Solicitá uno nuevo.</p>}
      <form className="mt-7 space-y-5" onSubmit={onSubmit}>
        <label className="block text-sm">
          Email
          <input
            className="mt-1 w-full rounded-md border px-3 py-2"
            type="email" autoComplete="email"
            required
            value={email}
            onChange={(event) => setEmail(event.target.value)}
          />
        </label>
        <label className="block text-sm">
          Contraseña
          <input
            className="mt-1 w-full rounded-md border px-3 py-2"
            type="password" autoComplete="current-password"
            required
            value={password}
            onChange={(event) => setPassword(event.target.value)}
          />
        </label>
        {error && <p className="text-sm text-red-600">{error}</p>}
        <button
          className="w-full rounded-lg bg-black px-4 py-3 text-sm font-medium text-white hover:bg-neutral-800 disabled:opacity-60"
          disabled={pending}
          type="submit"
        >
          Entrar
        </button>
      </form>
      <div className="mt-6 flex justify-between gap-3 text-xs"><Link href="/forgot-password" className="underline">Olvidé mi contraseña</Link><Link href="/signup" className="underline">Crear cuenta</Link></div>
    </main>
  );
}

export default function LoginPage() {
  // useSearchParams() needs a suspense boundary: the `next` parameter is only
  // known on the client.
  return (
    <Suspense fallback={null}>
      <LoginForm />
    </Suspense>
  );
}
