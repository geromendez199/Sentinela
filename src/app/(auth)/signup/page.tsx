'use client';

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
  }

  return (
    <main className="mx-auto flex min-h-screen max-w-sm flex-col justify-center px-6">
      <h1 className="text-2xl font-semibold">Crear cuenta</h1>
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
            minLength={12}
            required
            value={password}
            onChange={(event) => setPassword(event.target.value)}
          />
        </label>
        {message && <p className="text-sm">{message}</p>}
        <button
          className="w-full rounded-md bg-slate-900 px-4 py-2 text-sm text-white disabled:opacity-60"
          disabled={pending}
          type="submit"
        >
          Registrarme
        </button>
      </form>
    </main>
  );
}
