'use client';

import { useEffect, useState } from 'react';
import { useToast } from '@/components/ui/toast-provider';

export function ConnectionStatus() {
  const [offline, setOffline] = useState(false);
  const notify = useToast();
  useEffect(() => {
    const disconnected = () => setOffline(true);
    const connected = () => { setOffline(false); notify('Conexión recuperada. Podés reintentar tus operaciones.', 'info'); };
    setOffline(!navigator.onLine);
    window.addEventListener('offline', disconnected);
    window.addEventListener('online', connected);
    return () => { window.removeEventListener('offline', disconnected); window.removeEventListener('online', connected); };
  }, [notify]);
  return offline ? <div role="alert" className="border-b bg-neutral-900 px-5 py-3 text-center text-sm text-white">Sin conexión. Podés consultar lo cargado; las operaciones necesitan conexión.</div> : null;
}
