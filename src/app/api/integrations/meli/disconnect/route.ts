import { NextResponse, type NextRequest } from 'next/server';
import { z } from 'zod';
import { checkPermission } from '@/lib/auth/require-role';
import { createAdminClient } from '@/lib/supabase/admin';
import { logger } from '@/lib/observability/logger';

export const dynamic = 'force-dynamic';

const bodySchema = z.object({
  orgSlug: z.string().min(2),
  accountId: z.string().uuid(),
});

/**
 * Removes the link. Data retention is decided by the retention policy, not by
 * the disconnect: jobs stop, rows stay until their entity expires.
 */
export async function POST(request: NextRequest) {
  const parsed = bodySchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: 'invalid_request' }, { status: 400 });

  const permission = await checkPermission(parsed.data.orgSlug, 'accounts:disconnect');
  if (!permission.ok) return NextResponse.json({ error: 'forbidden' }, { status: permission.status });

  const supabase = createAdminClient();
  const { error } = await supabase.rpc('backend_disconnect_meli_account' as never, {
    p_account_id: parsed.data.accountId,
    p_org_id: permission.ctx.orgId,
    p_actor: permission.ctx.userId,
  } as never);

  if (error) {
    logger.error('meli_disconnect_failed', { org_id: permission.ctx.orgId, error });
    return NextResponse.json({ error: 'disconnect_failed' }, { status: 500 });
  }

  return NextResponse.json({ status: 'disconnected' });
}
