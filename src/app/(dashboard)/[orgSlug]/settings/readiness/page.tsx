import Link from 'next/link';
import { requirePermission } from '@/lib/auth/require-role';
import { createClient } from '@/lib/supabase/server';
import { Card } from '@/components/ui/card';
import { integrationReadiness } from '@/lib/operations/readiness';
import { formatDateTime } from '@/lib/utils/format';

export default async function ReadinessPage({params}:{params:Promise<{orgSlug:string}>}) {
  const {orgSlug}=await params,ctx=await requirePermission(orgSlug,'org:update'),supabase=await createClient();
  const checks=integrationReadiness(process.env);
  const [accounts,jobs,snapshot]=await Promise.all([
    supabase.from('meli_accounts').select('id,status,last_api_ok_at').eq('org_id',ctx.orgId).throwOnError(),
    supabase.from('sync_jobs').select('id,status,updated_at',{count:'exact'}).eq('org_id',ctx.orgId).in('status',['queued','running','failed','paused']).order('updated_at',{ascending:false}).limit(50).throwOnError(),
    supabase.from('reputation_snapshots').select('observed_at').eq('org_id',ctx.orgId).order('observed_at',{ascending:false}).limit(1).throwOnError(),
  ]);
  const states={ready:'Configurado en web',setup:'Completar configuración',disabled:'Desactivado',verify:'Requiere verificación'};
  return <div className="space-y-6"><Card title="Preparación operativa de Sentinela V2" subtitle="Separá configuración, datos disponibles y validación real de las integraciones."><div className="grid gap-4 sm:grid-cols-3"><div><p className="muted text-xs">Cuentas activas</p><p className="metric-number">{accounts.data.filter(account=>account.status==='active').length}</p></div><div><p className="muted text-xs">Trabajos que requieren seguimiento</p><p className="metric-number">{jobs.count??0}</p></div><div><p className="muted text-xs">Última reputación observada</p><p className="mt-3 text-sm font-medium">{formatDateTime(snapshot.data[0]?.observed_at)}</p></div></div></Card><Card title="Integraciones"><ul className="space-y-3">{checks.map(check=><li key={check.id} className="rounded-xl border p-4"><div className="flex flex-wrap items-center justify-between gap-3"><h3 className="text-sm font-semibold">{check.label}</h3><span className={`rounded-full px-3 py-1 text-[11px] ${check.state==='ready'?'bg-black text-white':'bg-neutral-100'}`}>{states[check.state]}</span></div><p className="muted mt-2 text-xs leading-relaxed">{check.detail}</p></li>)}</ul><p className="muted mt-4 text-xs">Se informa presencia de configuración, nunca los valores de secretos. Una conexión configurada aún necesita una prueba real de extremo a extremo.</p></Card><Card title="Prueba antes de operar"><ol className="list-inside list-decimal space-y-3 text-sm"><li>Conectá la cuenta y comprobá la primera sincronización.</li><li>Abrí una orden, una publicación y un reclamo real.</li><li>Guardá un borrador, revisalo y aprobalo sin confundir aprobación con envío.</li><li>Confirmá una alerta y verificá el estado después de actualizar.</li><li>Revisá tareas fallidas y la cola de recuperación.</li></ol><div className="mt-5 flex flex-wrap gap-3"><Link className="rounded-lg bg-black px-4 py-3 text-xs text-white" href={`/${orgSlug}/accounts`}>Revisar cuentas</Link><Link className="rounded-lg border px-4 py-3 text-xs" href={`/${orgSlug}/settings/operations`}>Ver operaciones</Link></div></Card></div>;
}
