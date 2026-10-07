'use client';

import Link from 'next/link';
import { BrandLogo } from '@/components/brand/brand-logo';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { clientEnv } from '@/lib/env/client';

export default function SignupPage() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [message, setMessage] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function onSubmit(event: React.FormEvent) {
    event.preventDefault();
    setPending(true);
    setMessage(null);

    try {
    const supabase = createClient();
    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: { emailRedirectTo: `${clientEnv.NEXT_PUBLIC_APP_URL}/auth/callback` },
    });

    setPending(false);
    if (error) {
      setMessage('No pudimos crear la cuenta. Revisa el email y la contrasena.');
      return;
    }
    setMessage('Revisa tu email para confirmar la cuenta.');
    router.refresh();
    } catch { setMessage('No pudimos conectar. Intentá nuevamente.'); }
    finally { setPending(false); }
  }

  return (
    <main className="card mx-auto my-10 flex w-[calc(100%-32px)] max-w-md flex-col px-7 py-10 sm:my-20 sm:px-10">
      <div className="mb-8"><BrandLogo /></div>
      <h1 className="text-2xl font-semibold tracking-tight">Crear cuenta</h1>
      <p className="muted mt-2 text-sm leading-relaxed">Un lugar para observar y entender tu operación.</p>
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
            type="password" autoComplete="new-password"
            minLength={12}
            required
            value={password}
            onChange={(event) => setPassword(event.target.value)}
          />
        </label>
        {message && <p className="text-sm">{message}</p>}
        <button
          className="w-full rounded-lg bg-black px-4 py-3 text-sm font-medium text-white hover:bg-neutral-800 disabled:opacity-60"
          disabled={pending}
          type="submit"
        >
          Registrarme
        </button>
      </form>
      <Link href="/login" className="mt-6 text-sm underline">Ya tengo una cuenta</Link>
    </main>
  );
}
