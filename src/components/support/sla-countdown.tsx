'use client';

import { useEffect, useState } from 'react';
import { getSlaStatus } from '@/lib/support/sla';

export function SlaCountdown({ dueAt }: { dueAt: string | null }) {
  const [now, setNow] = useState<Date | null>(null);
  useEffect(() => { setNow(new Date()); const timer = window.setInterval(() => setNow(new Date()), 30_000); return () => window.clearInterval(timer); }, []);
  if (!now) return <span className="muted mt-1 inline-flex text-xs">Consultando plazo…</span>;
  const status = getSlaStatus(dueAt, now);
  const urgent = status.state === 'overdue' || status.state === 'urgent';
  return <span className={`mt-1 inline-flex rounded-md px-2 py-1 text-xs font-medium ${urgent ? 'bg-black text-white' : 'bg-neutral-100 text-neutral-700'}`} aria-label={`SLA: ${status.label}`}>{urgent && <span aria-hidden="true" className="mr-1">!</span>}{status.label}</span>;
}
