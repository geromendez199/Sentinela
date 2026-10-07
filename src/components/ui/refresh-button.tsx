'use client';
import { useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { useToast } from './toast-provider';
export function RefreshButton() {
  const router = useRouter(); const [pending, startTransition] = useTransition();
  const notify = useToast();
  return <button type="button" aria-busy={pending} onClick={() => { notify('Actualizando la vista con los datos disponibles.', 'info'); startTransition(() => router.refresh()); }} disabled={pending} className="min-h-10 rounded-lg border bg-white px-4 py-2 text-xs hover:bg-neutral-100 disabled:opacity-50">{pending ? 'Actualizando…' : 'Actualizar vista'}</button>;
}
