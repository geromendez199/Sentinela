import { NextResponse, type NextRequest } from 'next/server';
import { z } from 'zod';
import { checkPermission } from '@/lib/auth/require-role';
import { createAdminClient } from '@/lib/supabase/admin';

export const dynamic = 'force-dynamic';

const bodySchema = z.object({
  orgSlug: z.string().min(2),
  resourceKind: z.enum(['reputation', 'orders', 'claims', 'shipments', 'items']).default('reputation'),
});

/** Operator-triggered reconciliation. Enqueues a job, never syncs inline. */
export async function POST(request: NextRequest, context: { params: Promise<{ accountId: string }> }) {
  const { accountId } = await context.params;
  const parsed = bodySchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: 'invalid_request' }, { status: 400 });

  const permission = await checkPermission(parsed.data.orgSlug, 'accounts:connect');
  if (!permission.ok) return NextResponse.json({ error: 'forbidden' }, { status: permission.status });

  const supabase = createAdminClient();
  const { data, error } = await supabase.rpc('backend_request_reconcile' as never, {
    p_account_id: accountId,
    p_org_id: permission.ctx.orgId,
    p_actor: permission.ctx.userId,
    p_resource_kind: parsed.data.resourceKind,
  } as never);

  if (error) return NextResponse.json({ error: 'reconcile_failed' }, { status: 500 });
  return NextResponse.json({ status: 'queued', jobId: data });
}
