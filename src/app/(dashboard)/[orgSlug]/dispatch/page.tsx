import Link from 'next/link';
import { requireOrg } from '@/lib/auth/require-role';
import { createClient } from '@/lib/supabase/server';
import { Card } from '@/components/ui/card';
import { DataTable } from '@/components/ui/data-table';
import { SlaCountdown } from '@/components/support/sla-countdown';
import { formatDateTime } from '@/lib/utils/format';
import { statusLabel } from '@/lib/ui/labels';
import { ListFilters,Pagination } from '@/components/ui/list-controls';
import { listQuery,PAGE_SIZE,numericSearch,type ListParams } from '@/lib/ui/list-query';

export default async function DispatchPage({params,searchParams}:{params:Promise<{orgSlug:string}>;searchParams:Promise<ListParams>}) {
  const {orgSlug}=await params,ctx=await requireOrg(orgSlug),supabase=await createClient();
  const sorts=['deadline','newest','oldest'],filters=listQuery(await searchParams,['ready_to_ship','pending','handling'],sorts);
  let query=supabase.from('shipments').select('shipment_id,meli_account_id,status,substatus,expected_dispatch_at,date_created,logistic_type').eq('org_id',ctx.orgId).is('shipped_at',null).is('delivered_at',null).or('status.is.null,status.neq.cancelled');
  if(filters.status)query=query.eq('status',filters.status);if(filters.q)query=query.eq('shipment_id',numericSearch(filters.q));
  const {data}=await query.order(filters.sort==='deadline'?'expected_dispatch_at':'date_created',{ascending:filters.sort!=='newest',nullsFirst:false}).order('shipment_id').range((filters.page-1)*PAGE_SIZE,filters.page*PAGE_SIZE).throwOnError();
  const rows=(data??[]).slice(0,PAGE_SIZE),ids=rows.map(row=>row.shipment_id);
  const orders=ids.length?(await supabase.from('orders').select('order_id,shipment_id,meli_account_id').eq('org_id',ctx.orgId).in('shipment_id',ids).limit(1000).throwOnError()).data??[]:[];
  return <Card title="Despachos por prioridad" subtitle="Envíos sin despacho registrado. Los vencimientos se muestran sólo cuando la fuente informa una fecha; revisá el estado actual antes de actuar."><ListFilters {...filters} sorts={sorts} statuses={['ready_to_ship','pending','handling']} placeholder="Número de envío"/><DataTable selectableLabel="envíos" rows={rows} rowKey={row=>String(row.shipment_id)} empty="Sin envíos pendientes para esta vista." emptyAction={<Link className="text-xs underline" href={`/${orgSlug}/accounts`}>Ver sincronización →</Link>} columns={[
    {key:'shipment',header:'Envío',render:row=>row.shipment_id},
    {key:'order',header:'Órdenes',render:row=><div className="flex flex-col gap-1">{orders.filter(order=>order.shipment_id===row.shipment_id&&order.meli_account_id===row.meli_account_id).map(order=><Link key={order.order_id} className="underline" href={`/${orgSlug}/orders/${order.order_id}`}>{order.order_id}</Link>)}</div>},
    {key:'status',header:'Estado',render:row=>statusLabel(row.status)},
    {key:'deadline',header:'Plazo de despacho',exportValue:row=>row.expected_dispatch_at??'',render:row=><div className="min-w-40"><p className="text-xs">{formatDateTime(row.expected_dispatch_at)}</p><SlaCountdown dueAt={row.expected_dispatch_at}/></div>},
    {key:'logistic',header:'Logística',render:row=>row.logistic_type??'Sin informar'},
  ]}/><Pagination {...filters} hasNext={(data?.length??0)>PAGE_SIZE}/></Card>;
}
