'use client';
import { BrandLogo } from '@/components/brand/brand-logo';
import Link from 'next/link';
import { useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { clientEnv } from '@/lib/env/client';
export default function ForgotPasswordPage() {
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState('');
  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault(); setPending(true); setMessage('');
    const email = String(new FormData(event.currentTarget).get('email'));
    try {
      const { error } = await createClient().auth.resetPasswordForEmail(email, { redirectTo: `${clientEnv.NEXT_PUBLIC_APP_URL}/auth/callback?next=/reset-password` });
      setMessage(error ? 'No pudimos procesar la solicitud. Intentá nuevamente más tarde.' : 'Si existe una cuenta con ese email, recibirás un enlace de recuperación.');
    } catch { setMessage('No pudimos conectar. Intentá nuevamente.'); }
    finally { setPending(false); }
  }
  return <main className="card mx-auto my-12 w-[calc(100%-32px)] max-w-md p-8"><div className="mb-6"><BrandLogo /></div><h1 className="text-2xl font-semibold">Recuperar contraseña</h1><form onSubmit={submit} className="mt-6 space-y-4"><label className="block">Email<input name="email" type="email" required className="mt-1 w-full rounded border p-2" /></label><button disabled={pending} className="rounded bg-slate-900 p-2 text-white disabled:opacity-60">Enviar enlace</button>{message && <p role="status">{message}</p>}</form><Link href="/login" className="mt-4 block text-sm underline">Volver a iniciar sesión</Link></main>;
}
