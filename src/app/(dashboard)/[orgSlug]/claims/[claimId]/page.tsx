import { notFound } from 'next/navigation';
import { requireOrg } from '@/lib/auth/require-role';
import { createClient } from '@/lib/supabase/server';
import { Card, EmptyState } from '@/components/ui/card';
import { SlaCountdown } from '@/components/support/sla-countdown';

export default async function ClaimDetailPage({
  params,
}: {
  params: Promise<{ orgSlug: string; claimId: string }>;
}) {
  const { orgSlug, claimId } = await params;
  const ctx = await requireOrg(orgSlug);
  const supabase = await createClient();

  const numericClaimId = Number(claimId);
  if (!Number.isFinite(numericClaimId)) notFound();

  const [claim, drafts] = await Promise.all([
    supabase.from('claims').select('*').eq('org_id', ctx.orgId).eq('claim_id', numericClaimId).maybeSingle(),
    supabase
      .from('action_drafts')
      .select('id, kind, status, rendered_text, created_at')
      .eq('org_id', ctx.orgId)
      .eq('claim_id', numericClaimId)
      .order('created_at', { ascending: false }),
  ]);
  for (const result of [claim, drafts]) {
    if (result.error) throw new Error('data_load_failed');
  }

  if (!claim.data) notFound();

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
            <dd>{claim.data.affects_reputation ?? 'sin consultar'}</dd>
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

      <Card title="Borradores" subtitle="Todo write a MercadoLibre requiere aprobacion humana explicita">
        {(drafts.data ?? []).length === 0 ? (
          <EmptyState message="Sin borradores para este reclamo." />
        ) : (
          <ul className="space-y-3 text-sm">
            {(drafts.data ?? []).map((draft) => (
              <li key={draft.id} className="card p-3">
                <div className="flex justify-between">
                  <span className="font-medium">{draft.kind}</span>
                  <span className="muted">{draft.status}</span>
                </div>
                {draft.rendered_text && <p className="mt-2 whitespace-pre-wrap">{draft.rendered_text}</p>}
              </li>
            ))}
          </ul>
        )}
      </Card>
      <p className="muted text-xs">Organizacion: {orgSlug}</p>
    </div>
  );
}
