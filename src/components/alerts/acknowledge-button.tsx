'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
export function AcknowledgeButton({orgSlug, alertId}: {orgSlug: string; alertId: string}) {
 const router=useRouter(); const [pending,setPending]=useState(false); const [message,setMessage]=useState('');
 async function acknowledge() {
  setPending(true);setMessage('');
  try {const response=await fetch(`/api/alerts/${alertId}/ack`, {method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify({orgSlug})});if(!response.ok){setMessage(response.status===409?'La alerta ya cambió de estado. Actualizá la página.':'No se pudo marcar la alerta.');return;}router.refresh();}
  catch {setMessage('No pudimos conectar. Intentá nuevamente.');} finally {setPending(false);}
 }
 return <div><button disabled={pending} onClick={()=>void acknowledge()} className="whitespace-nowrap rounded-lg border px-3 py-2 text-xs disabled:opacity-50">{pending?'Guardando…':'Marcar como vista'}</button>{message&&<p role="alert" className="mt-2 text-xs">{message}</p>}</div>;
}
