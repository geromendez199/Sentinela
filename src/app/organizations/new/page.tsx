'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';

export default function NewOrganizationPage() {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState('');
  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault(); setPending(true); setError('');
    const form = new FormData(event.currentTarget);
    try {
      const slug = String(form.get('slug')).toLowerCase();
      const { error } = await createClient().rpc('create_organization', { p_name: String(form.get('name')).trim(), p_slug: slug });
      if (error) {
        setError(error.code === '23505' ? 'Ese identificador ya existe. Elegí otro.' : 'No pudimos crear la organización. Revisá los datos e intentá nuevamente.');
        return;
      }
      router.push(`/${slug}/settings/integrations`); router.refresh();
    } catch { setError('No pudimos conectar con el servicio. Intentá nuevamente.'); }
    finally { setPending(false); }
  }
  return <main className="mx-auto max-w-lg px-6 py-16">
    <h1 className="text-2xl font-semibold">Crear organización</h1>
    <p className="muted mt-2">Serás su propietario. Luego podrás vincular tu cuenta de MercadoLibre.</p>
    <form onSubmit={submit} className="mt-6 space-y-4">
      <label className="block">Nombre<input name="name" required minLength={2} maxLength={120} className="mt-1 w-full rounded border p-2" /></label>
      <label className="block">Identificador<input name="slug" required pattern="[a-z0-9][a-z0-9-]{1,62}[a-z0-9]" minLength={3} maxLength={64} className="mt-1 w-full rounded border p-2" /><span className="muted text-sm">Letras minúsculas, números y guiones. No podrá empezar o terminar con un guion.</span></label>
      {error && <p role="alert" className="text-red-600">{error}</p>}
      <button disabled={pending} className="rounded bg-slate-900 px-4 py-2 text-white disabled:opacity-60">{pending ? 'Creando…' : 'Crear organización'}</button>
    </form>
  </main>;
}
