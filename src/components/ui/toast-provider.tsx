'use client';

import { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';

type Notice = { id: number; message: string; tone: 'success' | 'error' | 'info' };
const ToastContext = createContext<(message: string, tone?: Notice['tone']) => void>(() => {});

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [notices, setNotices] = useState<Notice[]>([]);
  const nextId = useRef(0);
  const timers = useRef(new Map<number, ReturnType<typeof setTimeout>>());
  const dismiss = useCallback((id: number) => {
    clearTimeout(timers.current.get(id));
    timers.current.delete(id);
    setNotices((current) => current.filter((notice) => notice.id !== id));
  }, []);
  const notify = useCallback((message: string, tone: Notice['tone'] = 'success') => {
    const id = ++nextId.current;
    setNotices((current) => [...current.slice(-3), { id, message, tone }]);
    timers.current.set(id, setTimeout(() => dismiss(id), tone === 'error' ? 12_000 : 6_000));
  }, [dismiss]);
  useEffect(() => {
    const pending = timers.current;
    return () => { pending.forEach(clearTimeout); pending.clear(); };
  }, []);
  return <ToastContext.Provider value={notify}>{children}
    <div role="region" aria-label="Notificaciones" className="pointer-events-none fixed bottom-4 right-4 z-[70] flex w-[calc(100%-32px)] max-w-sm flex-col gap-2">
      {notices.map((notice) => <div key={notice.id} role={notice.tone === 'error' ? 'alert' : 'status'} className="pointer-events-auto flex items-start gap-3 rounded-xl border border-neutral-300 bg-white p-4 shadow-lg">
        <span aria-hidden="true" className="flex size-6 shrink-0 items-center justify-center rounded-full bg-black text-xs text-white">{notice.tone === 'error' ? '!' : notice.tone === 'success' ? '✓' : 'i'}</span>
        <p className="flex-1 text-sm leading-relaxed">{notice.message}</p>
        <button type="button" onClick={() => dismiss(notice.id)} className="-m-2 flex size-10 items-center justify-center rounded-lg hover:bg-neutral-100" aria-label="Cerrar notificación">×</button>
      </div>)}
    </div>
  </ToastContext.Provider>;
}

export const useToast = () => useContext(ToastContext);
