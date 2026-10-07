'use client';
import { BrandLogo } from '@/components/brand/brand-logo';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
export default function ResetPasswordPage() {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState('');
  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault(); setPending(true); setMessage('');
    const form = new FormData(event.currentTarget);
    try {
      if (form.get('password') !== form.get('confirmation')) { setMessage('Las contraseñas no coinciden.'); return; }
      const client = createClient();
      const { data: { user } } = await client.auth.getUser();
      if (!user) { setMessage('El enlace venció. Solicitá uno nuevo desde Recuperar contraseña.'); return; }
      const { error } = await client.auth.updateUser({ password: String(form.get('password')) });
      if (error) { setMessage('No pudimos actualizar la contraseña. Solicitá un nuevo enlace e intentá nuevamente.'); return; }
      await client.auth.signOut(); router.replace('/login'); router.refresh();
    } catch { setMessage('No pudimos conectar. Intentá nuevamente.'); }
    finally { setPending(false); }
  }
  return <main className="card mx-auto my-12 w-[calc(100%-32px)] max-w-md p-8"><div className="mb-6"><BrandLogo /></div><h1 className="text-2xl font-semibold">Nueva contraseña</h1><form onSubmit={submit} className="mt-6 space-y-4">{['password', 'confirmation'].map((name, i) => <label className="block" key={name}>{i ? 'Confirmar contraseña' : 'Contraseña'}<input name={name} type="password" autoComplete="new-password" required minLength={12} className="mt-1 w-full rounded border p-2" /></label>)}<button disabled={pending} className="rounded bg-slate-900 p-2 text-white disabled:opacity-60">Guardar contraseña</button>{message && <p role="alert">{message}</p>}</form></main>;
}
