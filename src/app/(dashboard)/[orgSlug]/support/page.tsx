import Link from 'next/link';
import { requireOrg } from '@/lib/auth/require-role';
import { hasPermission } from '@/lib/auth/permissions';
import { createClient } from '@/lib/supabase/server';
import { Card, EmptyState } from '@/components/ui/card';
import { ListFilters, Pagination } from '@/components/ui/list-controls';
import { listQuery, literalSearch, PAGE_SIZE, type ListParams } from '@/lib/ui/list-query';
import { triageSupport } from '@/lib/support/triage';
import { ResponseWorkbench } from '@/components/support/response-workbench';
import { formatDateTime } from '@/lib/utils/format';

export default async function SupportPage({params,searchParams}:{params:Promise<{orgSlug:string}>;searchParams:Promise<ListParams>}) {
  const {orgSlug}=await params, ctx=await requireOrg(orgSlug), supabase=await createClient();
  const raw=await searchParams;
  const tab=raw.tab==='messages'?'messages':'questions';
  const filters=listQuery(raw,tab==='questions'?['UNANSWERED','ANSWERED','CLOSED']:[]);
  const from=(filters.page-1)*PAGE_SIZE;
  const rows = tab==='questions' ? (await (()=>{let query=supabase.from('questions').select('question_id,item_id,meli_account_id,text_sanitized,status,date_created,answered_at').eq('org_id',ctx.orgId);if(filters.status)query=query.eq('status',filters.status);if(filters.q)query=query.ilike('text_sanitized','%'+literalSearch(filters.q)+'%');return query.order('date_created',{ascending:filters.sort==='oldest',nullsFirst:false}).order('question_id',{ascending:false}).range(from,from+PAGE_SIZE).throwOnError();})()).data?.map(row=>({id:String(row.question_id),accountId:row.meli_account_id,text:row.text_sanitized,date:row.date_created,itemId:row.item_id,orderId:null,status:row.status,source:'question' as const})) ?? []
    : (await (()=>{let query=supabase.from('messages').select('message_id,meli_account_id,text_sanitized,date_created,order_id').eq('org_id',ctx.orgId).eq('actor_role','buyer');if(filters.q)query=query.ilike('text_sanitized','%'+literalSearch(filters.q)+'%');return query.order('date_created',{ascending:filters.sort==='oldest'}).order('message_id',{ascending:false}).range(from,from+PAGE_SIZE).throwOnError();})()).data?.map(row=>({id:row.message_id,accountId:row.meli_account_id,text:row.text_sanitized,date:row.date_created,itemId:null,orderId:row.order_id,status:null,source:'message' as const})) ?? [];
  return <div className="space-y-6"><nav aria-label="Canales de atención" className="flex gap-2">{[['questions','Preguntas pre-venta'],['messages','Mensajes posventa']].map(([value,label])=><Link key={value} aria-current={tab===value?'page':undefined} href={`/${orgSlug}/support?tab=${value}`} className={`min-h-11 rounded-lg border px-4 py-3 text-xs ${tab===value?'bg-black text-white':'bg-white'}`}>{label}</Link>)}</nav><Card title={tab==='questions'?'Preguntas de tus publicaciones':'Mensajes del comprador'} subtitle="Señales de intención y frustración orientativas. La revisión humana decide la respuesta.">
    <ListFilters {...filters} statuses={tab==='questions'?['UNANSWERED','ANSWERED','CLOSED']:[]} placeholder="Texto del comprador" extraParams={{tab}} />
    {!rows.length?<EmptyState message="Sin conversaciones para esta vista." action={<Link href={`/${orgSlug}/accounts`} className="text-xs underline">Revisar sincronización →</Link>}/>:<ul className="space-y-4">{rows.slice(0,PAGE_SIZE).map(row=>{const triage=triageSupport(row.text);return <li key={row.accountId+':'+row.id} className="rounded-xl border p-4 sm:p-5"><div className="flex flex-wrap items-center justify-between gap-2"><p className="text-xs font-medium">{row.source==='question'?'Pregunta':'Mensaje'} {row.id}</p><span className={`rounded-full px-3 py-1 text-[11px] ${triage.priority==='urgent'?'bg-black text-white':'bg-neutral-100'}`}>{triage.priority==='urgent'?'Revisar con prioridad':triage.priority==='watch'?'Señal para revisar':'Atención habitual'}</span></div><p className="mt-3 whitespace-pre-wrap text-sm leading-relaxed">{row.text??'Texto no disponible en la fuente'}</p><p className="muted mt-3 text-[11px]">{formatDateTime(row.date)}{row.status?' · '+row.status:''}</p><div className="mt-3 flex flex-wrap gap-3 text-xs">{row.itemId&&<Link className="underline" href={`/${orgSlug}/listings/${row.itemId}`}>Ver publicación →</Link>}{row.orderId&&<Link className="underline" href={`/${orgSlug}/orders/${row.orderId}`}>Ver orden →</Link>}{triage.cause&&<span className="muted">Señal: {triage.cause.label}</span>}</div><ResponseWorkbench orgSlug={orgSlug} accountId={row.accountId} source={row.source} resourceId={row.id} text={row.text} canSave={hasPermission(ctx.role,'actions:approve')}/></li>;})}</ul>}
    <Pagination {...filters} hasNext={rows.length>PAGE_SIZE} extraParams={{tab}} />
  </Card></div>;
}
