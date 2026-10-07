'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
export function DisconnectAccountButton({orgSlug,accountId}:{orgSlug:string;accountId:string}) {
 const router=useRouter();const [pending,setPending]=useState(false);const [message,setMessage]=useState('');const [confirm,setConfirm]=useState(false);
 async function disconnect(){
  if(!confirm) return;
  setPending(true);setMessage('');
  try {const response=await fetch('/api/integrations/meli/disconnect',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({orgSlug,accountId})});if(!response.ok){setMessage('No pudimos desvincular la cuenta. Intentá nuevamente.');return;}router.refresh();}
  catch{setMessage('No pudimos conectar. Intentá nuevamente.');}finally{setPending(false);}
 }
 return <div className="mt-4"><p className="muted text-sm">Desvincular detiene la sincronización. Los datos se conservan según la política de retención.</p><button type="button" disabled={pending} onClick={()=>confirm ? void disconnect() : setConfirm(true)} className="mt-2 rounded border px-3 py-2 disabled:opacity-60">{confirm ? 'Confirmar desvinculación' : 'Desvincular cuenta'}</button>{confirm && <button className="ml-3 text-sm underline" disabled={pending} onClick={()=>setConfirm(false)}>Cancelar</button>}{message && <p role="alert">{message}</p>}</div>;
}
