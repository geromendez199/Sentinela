'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useToast } from '@/components/ui/toast-provider';

export function RetryDeadLetterButton({ orgSlug, id }: { orgSlug: string; id: number }) {
  const router = useRouter();
  const notify = useToast();
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState('');

  async function retry(): Promise<void> {
    setPending(true);
    setMessage('');
    try {
      const response = await fetch(`/api/operations/dead-letters/${id}/retry`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Idempotency-Key': crypto.randomUUID() },
        body: JSON.stringify({ orgSlug }),
      });
      if (!response.ok) throw new Error('retry_failed');
      notify('Trabajo reenviado. Podés seguir su estado desde Operaciones.');
      router.refresh();
    } catch {
      setMessage('No se pudo reencolar. Intentá nuevamente.');
      notify('No se pudo reenviar el trabajo. Reintentá después de revisar el motivo.', 'error');
    } finally {
      setPending(false);
    }
  }

  return <div><button type="button" disabled={pending} onClick={() => void retry()} className="rounded-lg border border-neutral-300 px-3 py-2 text-xs font-medium hover:bg-neutral-100 disabled:opacity-50">{pending ? 'Reencolando…' : 'Reintentar'}</button>{message && <p role="alert" className="mt-1 text-[11px] text-red-700">{message}</p>}</div>;
}
