import { notFound } from 'next/navigation';
import { requireOrg } from '@/lib/auth/require-role';
import { createClient } from '@/lib/supabase/server';
import { Card, EmptyState } from '@/components/ui/card';
import { SlaCountdown } from '@/components/support/sla-countdown';
import { ResponseWorkbench } from '@/components/support/response-workbench';
import { ResolutionWorkbench } from '@/components/support/resolution-workbench';
import { ActionApprovalPanel } from '@/components/actions/action-approval-panel';
import { hasPermission } from '@/lib/auth/permissions';
import { numericSearch } from '@/lib/ui/list-query';
import { formatDateTime } from '@/lib/utils/format';
import { reputationImpactLabel } from '@/lib/ui/labels';

export default async function ClaimDetailPage({
  params,
}: {
  params: Promise<{ orgSlug: string; claimId: string }>;
}) {
  const { orgSlug, claimId } = await params;
  const ctx = await requireOrg(orgSlug);
  const supabase = await createClient();

  const numericClaimId = numericSearch(claimId);
  if (numericClaimId < 0) notFound();

  const [claim, drafts] = await Promise.all([
    supabase.from('claims').select('*').eq('org_id', ctx.orgId).eq('claim_id', numericClaimId).maybeSingle(),
    supabase
      .from('action_drafts')
      .select('id, kind, status, rendered_text, requires_approval, created_at')
      .eq('org_id', ctx.orgId)
      .eq('claim_id', numericClaimId)
      .order('created_at', { ascending: false }),
  ]);
  for (const result of [claim, drafts]) {
    if (result.error) throw new Error('data_load_failed');
  }

  if (!claim.data) notFound();
  const accountId=claim.data.meli_account_id;
  const [messages,order]=await Promise.all([
    supabase.from('claim_messages').select('id,sender_role,text_sanitized,date_created').eq('org_id',ctx.orgId).eq('meli_account_id',accountId).eq('claim_id',numericClaimId).order('date_created',{ascending:false,nullsFirst:false}).limit(100).throwOnError(),
    supabase.from('orders').select('order_id,shipment_id,status,total_amount,currency_id').eq('org_id',ctx.orgId).eq('meli_account_id',accountId).eq('order_id',claim.data.order_id??-1).maybeSingle().throwOnError(),
  ]);
  const shipment=order.data?.shipment_id?(await supabase.from('shipments').select('shipment_id,status,shipped_at,delivered_at').eq('org_id',ctx.orgId).eq('meli_account_id',accountId).eq('shipment_id',order.data.shipment_id).maybeSingle().throwOnError()).data:null;
  const evidence=[`Reclamo ${claim.data.claim_id}: ${claim.data.status??'estado no informado'}`, ...(order.data?[`Orden ${order.data.order_id}: ${order.data.status}`]:[]), ...(shipment?[`Envío ${shipment.shipment_id}: ${shipment.status??'estado no informado'}`, ...(shipment.shipped_at?[`Despachado: ${formatDateTime(shipment.shipped_at)}`]:[]), ...(shipment.delivered_at?[`Entrega registrada: ${formatDateTime(shipment.delivered_at)}`]:[])]:[])];

  return (
    <div className="space-y-6">
      <Card title={`Reclamo ${claim.data.claim_id}`}>
        <dl className="grid gap-2 text-sm md:grid-cols-2">
          <div className="flex justify-between">
            <dt className="muted">Estado</dt>
            <dd>{claim.data.status ?? '—'}</dd>
          </div>
          <div className="flex justify-between">
            <dt className="muted">Etapa</dt>
            <dd>{claim.data.stage ?? '—'}</dd>
          </div>
          <div className="flex justify-between">
            <dt className="muted">Responsable de la accion</dt>
            <dd>{claim.data.action_responsible ?? '—'}</dd>
          </div>
          <div className="flex justify-between">
            <dt className="muted">Afecta reputacion</dt>
            <dd>{reputationImpactLabel(claim.data.affects_reputation)}</dd>
          </div>
          <div className="flex justify-between">
            <dt className="muted">Vence</dt>
            <dd><SlaCountdown dueAt={claim.data.due_date} /></dd>
          </div>
          <div className="flex justify-between">
            <dt className="muted">Acciones disponibles</dt>
            <dd>{(claim.data.available_actions ?? []).join(', ') || '—'}</dd>
          </div>
        </dl>
      </Card>

      <Card title="Conversación del reclamo" subtitle="Últimos 100 mensajes sincronizados, en orden cronológico.">{messages.data?.length?<ol className="space-y-3">{[...messages.data].reverse().map(message=><li key={message.id} className="rounded-xl border p-4"><p className="muted text-xs">{message.sender_role??'Participante'} · {formatDateTime(message.date_created)}</p><p className="mt-2 whitespace-pre-wrap text-sm">{message.text_sanitized??'Texto no informado'}</p></li>)}</ol>:<EmptyState message="Sin mensajes sincronizados para este reclamo."/>}<ResponseWorkbench orgSlug={orgSlug} accountId={accountId} source="claim" resourceId={String(numericClaimId)} text={claim.data.problem_sanitized} canSave={hasPermission(ctx.role,'actions:approve')}/></Card>
      <ResolutionWorkbench problem={claim.data.problem_sanitized} evidence={evidence} amount={order.data?.total_amount??null} currency={order.data?.currency_id??null}/>

      <Card title="Borradores" subtitle="Revisá y aprobá el texto antes de utilizarlo. Aprobar un borrador no envía una respuesta.">
        {(drafts.data ?? []).length === 0 ? (
          <EmptyState message="Sin borradores para este reclamo." />
        ) : (
          <ul className="space-y-3 text-sm">
            {(drafts.data ?? []).map((draft) => (
              <li key={draft.id}>{hasPermission(ctx.role,'actions:approve')?<ActionApprovalPanel orgSlug={orgSlug} action={draft}/>:<p>{draft.rendered_text??draft.kind}</p>}</li>
            ))}
          </ul>
        )}
      </Card>
      <p className="muted text-xs">Organizacion: {orgSlug}</p>
    </div>
  );
}
