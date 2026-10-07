'use client';
import { useTransition } from 'react';
import { useRouter } from 'next/navigation';
export function RefreshButton() {
  const router = useRouter(); const [pending, startTransition] = useTransition();
  return <button onClick={() => startTransition(() => router.refresh())} disabled={pending} className="rounded-lg border bg-white px-4 py-2 text-xs disabled:opacity-50">{pending ? 'Actualizando…' : 'Actualizar datos'}</button>;
}
