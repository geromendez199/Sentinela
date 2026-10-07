import { SyncPanel } from '@/components/accounts/sync-panel';
import { DisconnectAccountButton } from '@/components/settings/disconnect-account-button';
import { hasPermission } from '@/lib/auth/permissions';
import { notFound } from 'next/navigation';
import { requireOrg } from '@/lib/auth/require-role';
import { createClient } from '@/lib/supabase/server';
import { Card } from '@/components/ui/card';
import { formatDateTime } from '@/lib/utils/format';
import { statusLabel } from '@/lib/ui/labels';

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

  if (account.error || jobs.error) throw new Error('account_load_failed');
  if (!account.data) notFound();

  return (
    <div className="space-y-6">
      <Card title={account.data.nickname ?? String(account.data.seller_id)} subtitle={`Sitio ${account.data.site_id}`}>
        <dl className="grid gap-2 text-sm md:grid-cols-2">
          <div className="flex justify-between">
            <dt className="muted">Estado</dt>
            <dd>{statusLabel(account.data.status)}</dd>
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

      <SyncPanel jobs={jobs.data ?? []} />
      {account.data.status !== 'disconnected' && hasPermission(ctx.role, 'accounts:disconnect') && <Card title="Administrar conexión"><DisconnectAccountButton orgSlug={orgSlug} accountId={accountId} /></Card>}
      <p className="muted text-xs">Organizacion {orgSlug}</p>
    </div>
  );
}
