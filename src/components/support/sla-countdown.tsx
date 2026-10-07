'use client';

import { useEffect, useState } from 'react';
import { getSlaStatus } from '@/lib/support/sla';

export function SlaCountdown({ dueAt }: { dueAt: string | null }) {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => { const timer = window.setInterval(() => setNow(new Date()), 30_000); return () => window.clearInterval(timer); }, []);
  const status = getSlaStatus(dueAt, now);
  const color = status.state === 'overdue' ? 'text-red-700' : status.state === 'urgent' ? 'text-orange-700' : 'text-neutral-700';
  return <span className={`font-medium ${color}`} role="status" aria-label={`SLA: ${status.label}`}>{status.label}</span>;
}
