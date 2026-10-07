'use client';

import { useEffect, useTransition } from 'react';
import { useRouter } from 'next/navigation';

export function SyncAutoRefresh({ active }: { active: boolean }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  useEffect(() => {
    if (!active) return;
    const timer = window.setInterval(() => {
      if (document.visibilityState === 'visible' && navigator.onLine && !pending) startTransition(() => router.refresh());
    }, 15_000);
    return () => window.clearInterval(timer);
  }, [active, pending, router]);
  return active ? <p role="status" className="muted text-xs">{pending ? 'Consultando el avance…' : 'La vista se actualiza cada 15 segundos mientras está visible.'}</p> : null;
}
