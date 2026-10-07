'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import type { OrgRole } from '@/lib/supabase/schema-types';
export function MemberManager({ orgId, actorRole, members }: { orgId: string; actorRole: OrgRole; members: Array<{ user_id: string; role: OrgRole }> }) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState('');
  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault(); setPending(true); setMessage('');
    const form = new FormData(event.currentTarget);
    const userId = String(form.get('user_id'));
    try {
      const client = createClient();
      const { error } = form.get('operation') === 'remove'
        ? await client.rpc('remove_organization_member', { p_org_id: orgId, p_user_id: userId })
        : await client.rpc('set_organization_member_role', { p_org_id: orgId, p_user_id: userId, p_role: String(form.get('role')) as OrgRole });
      if (error) { setMessage('No se pudo guardar. Verificá que el usuario exista, tus permisos y que quede al menos un propietario.'); return; }
      setMessage('Miembros actualizados.'); router.refresh();
    } catch { setMessage('No pudimos conectar. Intentá nuevamente.'); }
    finally { setPending(false); }
  }
  const roles: OrgRole[] = actorRole === 'owner' ? ['owner', 'admin', 'operator', 'viewer'] : ['operator', 'viewer'];
  return <section className="mt-6 space-y-4">
    <h2 className="font-medium">Agregar o cambiar rol</h2>
    <p className="muted text-sm">El usuario debe registrarse primero y compartir su identificador, disponible en la portada de su cuenta.</p>
    <form onSubmit={submit} className="flex flex-wrap items-end gap-3">
      <label className="flex-1 text-sm">Identificador del usuario<input name="user_id" required pattern="[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}" className="mt-1 w-full rounded border p-2" /></label>
      <label className="text-sm">Rol<select name="role" defaultValue="viewer" className="mt-1 block rounded border p-2">{roles.map(role => <option key={role}>{role}</option>)}</select></label>
      <button disabled={pending} className="rounded bg-slate-900 p-2 text-white disabled:opacity-60">Guardar miembro</button>
    </form>
    <h2 className="font-medium">Remover miembro</h2>
    <form onSubmit={submit} className="flex flex-wrap gap-3">
      <input type="hidden" name="operation" value="remove" />
      <select aria-label="Miembro a remover" name="user_id" defaultValue="" required className="max-w-full rounded border p-2"><option value="" disabled>Elegí un miembro</option>{members.filter(m => actorRole === 'owner' || roles.includes(m.role)).map(m => <option key={m.user_id} value={m.user_id}>{m.user_id} · {m.role}</option>)}</select>
      <label className="flex items-center gap-2 text-xs"><input type="checkbox" required /> Confirmo que quiero quitar su acceso</label><button disabled={pending} className="rounded border p-2 disabled:opacity-60">Remover miembro</button>
    </form>
    {message && <p role="status" className="text-sm">{message}</p>}
  </section>;
}
