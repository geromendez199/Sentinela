'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';

export interface ApprovableAction {
  id: string;
  kind: string;
  status: string;
  rendered_text: string | null;
  requires_approval: boolean;
}

/**
 * Approval UI. Approving and executing are two separate calls on purpose: the
 * execute worker re-validates policy right before the write.
 */
export function ActionApprovalPanel({ orgSlug, action }: { orgSlug: string; action: ApprovableAction }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  async function call(path: string) {
    setError(null);
    const response = await fetch(path, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ orgSlug }),
    });
    if (!response.ok) {
      const payload = (await response.json().catch(() => ({}))) as { error?: string };
      setError(payload.error ?? 'request_failed');
      return;
    }
    startTransition(() => router.refresh());
  }

  const canApprove = action.status === 'draft' || action.status === 'pending_approval';
  const canExecute = action.status === 'approved';

  return (
    <div className="card p-3">
      <div className="flex justify-between text-sm">
        <span className="font-medium">{action.kind}</span>
        <span className="muted">{action.status}</span>
      </div>
      {action.rendered_text && <p className="mt-2 whitespace-pre-wrap text-sm">{action.rendered_text}</p>}
      {error && <p className="mt-2 text-xs text-red-600">{error}</p>}
      <div className="mt-3 flex gap-2">
        <button
          type="button"
          disabled={!canApprove || pending}
          onClick={() => void call(`/api/actions/${action.id}/approve`)}
          className="rounded bg-slate-900 px-3 py-1 text-xs text-white disabled:opacity-40"
        >
          Aprobar
        </button>
        <button
          type="button"
          disabled={!canExecute || pending}
          onClick={() => void call(`/api/actions/${action.id}/execute`)}
          className="rounded border px-3 py-1 text-xs disabled:opacity-40"
        >
          Ejecutar
        </button>
        <button
          type="button"
          disabled={pending || action.status === 'executed'}
          onClick={() => void call(`/api/actions/${action.id}/cancel`)}
          className="rounded border px-3 py-1 text-xs disabled:opacity-40"
        >
          Cancelar
        </button>
      </div>
    </div>
  );
}
