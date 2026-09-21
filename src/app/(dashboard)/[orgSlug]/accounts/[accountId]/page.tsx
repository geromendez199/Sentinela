import { notFound } from 'next/navigation';
import { requireOrg } from '@/lib/auth/require-role';
import { createClient } from '@/lib/supabase/server';
import { Card, EmptyState } from '@/components/ui/card';
import { formatDateTime } from '@/lib/utils/format';

export default async function AccountDetailPage({
  params,
}: {
  params: Promise<{ orgSlug: string; accountId: string }>;
}) {
  const { orgSlug, accountId } = await params;
  const ctx = await requireOrg(orgSlug);
  const supabase = await createClient();

  const [account, jobs] = await Promise.all([
    supabase.from('meli_accounts').select('*').eq('org_id', ctx.orgId).eq('id', accountId).maybeSingle(),
    supabase
      .from('sync_jobs')
      .select('id, kind, resource_kind, status, progress, processed_count, last_error, updated_at')
      .eq('org_id', ctx.orgId)
      .eq('meli_account_id', accountId)
      .order('updated_at', { ascending: false })
      .limit(20),
  ]);

  if (!account.data) notFound();

  return (
    <div className="space-y-6">
      <Card title={account.data.nickname ?? String(account.data.seller_id)} subtitle={`Sitio ${account.data.site_id}`}>
        <dl className="grid gap-2 text-sm md:grid-cols-2">
          <div className="flex justify-between">
            <dt className="muted">Estado</dt>
            <dd>{account.data.status}</dd>
          </div>
          <div className="flex justify-between">
            <dt className="muted">Motivo</dt>
            <dd>{account.data.status_reason ?? '—'}</dd>
          </div>
          <div className="flex justify-between">
            <dt className="muted">Medalla oficial</dt>
            <dd>{account.data.power_seller_status ?? '—'}</dd>
          </div>
          <div className="flex justify-between">
            <dt className="muted">Ultima sync de reputacion</dt>
            <dd>{formatDateTime(account.data.last_reputation_sync_at)}</dd>
          </div>
        </dl>
      </Card>

      <Card title="Jobs de sincronizacion" subtitle="El backfill es reanudable: nunca reinicia desde el dia 1">
        {(jobs.data ?? []).length === 0 ? (
          <EmptyState message="Sin jobs." />
        ) : (
          <ul className="space-y-2 text-sm">
            {(jobs.data ?? []).map((job) => (
              <li key={job.id} className="flex flex-wrap justify-between gap-2">
                <span>
                  {job.kind} · {job.resource_kind ?? '—'}
                </span>
                <span className="muted">
                  {job.status} · {(Number(job.progress) * 100).toFixed(1)}% · {job.processed_count} registros
                </span>
                {job.last_error && <span className="w-full text-xs text-red-600">{job.last_error}</span>}
              </li>
            ))}
          </ul>
        )}
      </Card>
      <p className="muted text-xs">Organizacion {orgSlug}</p>
    </div>
  );
}
