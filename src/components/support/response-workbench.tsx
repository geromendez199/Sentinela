'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { responseTemplate, triageSupport, validateSupportDraft } from '@/lib/support/triage';
import { useToast } from '@/components/ui/toast-provider';

export function ResponseWorkbench({ orgSlug, accountId, source, resourceId, text, canSave }: { orgSlug: string; accountId: string; source:'question'|'message'|'claim'; resourceId:string; text:string|null; canSave:boolean }) {
  const [draft,setDraft]=useState('');
  const [previous,setPrevious]=useState('');
  const [pending,setPending]=useState(false);
  const [saved,setSaved]=useState(false);
  const [error,setError]=useState('');
  const notify=useToast(), router=useRouter();
  const triage=triageSupport(text);
  const max=source==='question'?2000:350;
  const issues=validateSupportDraft(draft,max);
  async function save() {
    if(pending || issues.length) return;
    setPending(true);setError('');
    try {
      const response=await fetch('/api/support/drafts',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({orgSlug,accountId,source,resourceId,text:draft})});
      if(!response.ok) throw new Error('save_failed');
      setSaved(true);notify('Borrador guardado. Revisalo en Acciones antes de usarlo.');router.refresh();
    } catch { setError('No se pudo guardar. Tu texto sigue en el editor; reintentá.');notify('El borrador no se guardó. Reintentá.','error'); }
    finally {setPending(false);}
  }
  async function suggest() {
    if(pending)return;setPending(true);setError('');
    try {
      const response=await fetch('/api/support/suggest',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({orgSlug,accountId,source,resourceId})});
      if(response.status===409){setError('El proveedor de IA todavía no está configurado. Usá una plantilla o escribí la respuesta.');return;}
      if(!response.ok)throw new Error('suggest_failed');
      const result=await response.json() as {text:string};setPrevious(draft);setDraft(result.text);setSaved(false);notify('Propuesta generada. Revisá los hechos antes de guardar.');
    }catch{setError('La IA no pudo generar una propuesta válida. Podés usar la plantilla y seguir trabajando.');}finally{setPending(false);}
  }
  return <details className="mt-4 rounded-xl border p-4"><summary className="cursor-pointer text-xs font-semibold">Preparar respuesta revisable</summary><div className="mt-4 space-y-3">
    <p className="muted text-xs leading-relaxed">{triage.cause ? `Señal orientativa: ${triage.cause.label}. ${triage.cause.action}` : 'Revisá los datos de la compra o publicación antes de responder.'} El texto es un borrador; no se envía desde este editor.</p>
    <div className="flex flex-wrap gap-2"><button type="button" disabled={pending} onClick={()=>{setPrevious(draft);setDraft(responseTemplate(text,source));setSaved(false);}} className="min-h-10 rounded-lg border px-3 text-xs">Usar plantilla de inicio</button><button type="button" disabled={!canSave||pending} onClick={()=>void suggest()} className="min-h-10 rounded-lg border px-3 text-xs disabled:opacity-40">{pending?'Procesando…':'Proponer con IA'}</button>{previous&&<button type="button" disabled={pending} onClick={()=>{setDraft(previous);setPrevious(draft);setSaved(false);}} className="min-h-10 rounded-lg border px-3 text-xs">Recuperar texto anterior</button>}</div>
    <label className="block text-xs font-medium">Respuesta<textarea aria-label="Respuesta" disabled={pending} value={draft} onChange={event=>{setDraft(event.target.value);setSaved(false);}} rows={4} maxLength={max+100} className="mt-2 w-full border p-3 text-sm disabled:opacity-60" /></label>
    <p className="muted text-[11px]">{draft.length}/{max} caracteres · Plantilla editable, sin afirmaciones sobre stock, entregas o reembolsos no confirmados.</p>
    {draft && issues.length>0 && <ul className="space-y-1 text-xs" aria-label="Revisión del borrador">{issues.map(issue=><li key={issue}>! {issue}</li>)}</ul>}
    <div className="flex flex-wrap gap-2"><button type="button" disabled={!canSave||pending||saved||issues.length>0} onClick={()=>void save()} className="min-h-10 rounded-lg bg-black px-4 text-xs text-white disabled:opacity-40">{pending?'Guardando…':saved?'Guardado ✓':'Guardar para revisión'}</button><button type="button" disabled={!draft||issues.length>0} onClick={async()=>{try{await navigator.clipboard.writeText(draft);notify('Borrador copiado. Verificá los datos antes de utilizarlo.');}catch{notify('No se pudo copiar. Seleccioná el texto del editor.','error');}}} className="min-h-10 rounded-lg border px-3 text-xs disabled:opacity-40">Copiar borrador</button></div>
    {!canSave&&<p className="muted text-xs">Tu rol permite consultar; el guardado requiere un operador o administrador.</p>}{error&&<p role="alert" className="text-xs">{error}</p>}
  </div></details>;
}
