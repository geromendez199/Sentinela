'use client';

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

    const supabase = createClient();
    const { error: signInError } = await supabase.auth.signInWithPassword({ email, password });

    if (signInError) {
      // Never echo the provider message: it distinguishes existing accounts.
      setError('No pudimos iniciar sesion con esas credenciales.');
      setPending(false);
      return;
    }

    router.replace(searchParams.get('next') ?? '/');
    router.refresh();
  }

  return (
    <main className="mx-auto flex min-h-screen max-w-sm flex-col justify-center px-6">
      <div className="mb-6"><BrandLogo /></div>
      <h1 className="text-2xl font-semibold">Iniciar sesion</h1>
      <form className="mt-6 space-y-4" onSubmit={onSubmit}>
        <label className="block text-sm">
          Email
          <input
            className="mt-1 w-full rounded-md border px-3 py-2"
            type="email"
            required
            value={email}
            onChange={(event) => setEmail(event.target.value)}
          />
        </label>
        <label className="block text-sm">
          Contrasena
          <input
            className="mt-1 w-full rounded-md border px-3 py-2"
            type="password"
            required
            value={password}
            onChange={(event) => setPassword(event.target.value)}
          />
        </label>
        {error && <p className="text-sm text-red-600">{error}</p>}
        <button
          className="w-full rounded-md bg-slate-900 px-4 py-2 text-sm text-white disabled:opacity-60"
          disabled={pending}
          type="submit"
        >
          Entrar
        </button>
      </form>
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
