import Link from 'next/link';
import { requireOrg } from '@/lib/auth/require-role';
import { createClient } from '@/lib/supabase/server';
import { diagnoseListing } from '@/lib/listings/health';
import { Card } from '@/components/ui/card';
import { DataTable } from '@/components/ui/data-table';
import { ListFilters, Pagination } from '@/components/ui/list-controls';
import { listQuery,literalSearch,PAGE_SIZE,type ListParams } from '@/lib/ui/list-query';
import { statusLabel } from '@/lib/ui/labels';

export default async function QualityPage({params,searchParams}:{params:Promise<{orgSlug:string}>;searchParams:Promise<ListParams>}) {
  const {orgSlug}=await params,ctx=await requireOrg(orgSlug),supabase=await createClient();
  const statuses=['active','paused','under_review','closed'],filters=listQuery(await searchParams,statuses);
  let query=supabase.from('items').select('item_id,title,status,available_quantity,raw_sanitized,health,source_last_updated').eq('org_id',ctx.orgId);
  if(filters.status)query=query.eq('status',filters.status);if(filters.q)query=query.ilike('title','%'+literalSearch(filters.q)+'%');
  const {data}=await query.order('source_last_updated',{ascending:filters.sort==='oldest'}).order('item_id').range((filters.page-1)*PAGE_SIZE,filters.page*PAGE_SIZE).throwOnError();
  const rows=(data??[]).slice(0,PAGE_SIZE).map(row=>({...row,report:diagnoseListing({title:row.title,status:row.status,availableQuantity:row.available_quantity,raw:row.raw_sanitized})}));
  return <Card title="Calidad y experiencia por publicación" subtitle="Detectá información incompleta, estados en revisión y señales de disponibilidad. Abrí cada publicación para revisar la incidencia de reclamos en sus ventas observadas."><ListFilters {...filters} statuses={statuses} placeholder="Título de la publicación"/><DataTable selectableLabel="publicaciones" rows={rows} rowKey={row=>row.item_id} empty="Sin publicaciones para analizar." emptyAction={<Link href={`/${orgSlug}/accounts`} className="text-xs underline">Ver sincronización →</Link>} columns={[
    {key:'title',header:'Publicación',render:row=><Link className="font-medium underline" href={`/${orgSlug}/listings/${row.item_id}`}>{row.title??row.item_id}</Link>},
    {key:'status',header:'Estado',render:row=>statusLabel(row.status)},
    {key:'findings',header:'Señales',exportValue:row=>row.report.findings.length,render:row=><span className={`rounded-full px-3 py-1 text-xs ${row.report.status==='attention'?'bg-black text-white':'bg-neutral-100'}`}>{row.report.findings.length} por revisar</span>},
    {key:'areas',header:'Áreas a revisar',render:row=>[...new Set(row.report.findings.map(finding=>finding.area))].join(', ')||'Sin señales en datos disponibles'},
    {key:'coverage',header:'Cobertura',render:row=>row.report.unknown.length?'Falta información de '+row.report.unknown.join(', '):'Campos observados'},
    {key:'official',header:'Salud informada por MELI',render:row=>row.health===null?'No informada':`${Math.round(row.health*100)} / 100`},
  ]}/><Pagination {...filters} hasNext={(data?.length??0)>PAGE_SIZE}/></Card>;
}
