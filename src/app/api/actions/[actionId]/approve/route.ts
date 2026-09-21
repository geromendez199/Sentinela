import { NextResponse, type NextRequest } from 'next/server';
import { z } from 'zod';
import { checkPermission } from '@/lib/auth/require-role';
import { createAdminClient } from '@/lib/supabase/admin';
import { logger } from '@/lib/observability/logger';
import { correlationFromHeaders } from '@/lib/observability/correlation';

export const dynamic = 'force-dynamic';

const bodySchema = z.object({ orgSlug: z.string().min(2) });

/**
 * Human approval (section 8.4). Approval alone never writes to MercadoLibre:
 * the execute worker re-checks policy immediately before the call.
 */
export async function POST(request: NextRequest, context: { params: Promise<{ actionId: string }> }) {
  const { actionId } = await context.params;
  const correlationId = correlationFromHeaders(request.headers);

  const parsed = bodySchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: 'invalid_request' }, { status: 400 });

  const permission = await checkPermission(parsed.data.orgSlug, 'actions:approve');
  if (!permission.ok) return NextResponse.json({ error: 'forbidden' }, { status: permission.status });

  const supabase = createAdminClient();
  const { error } = await supabase.rpc('backend_approve_action' as never, {
    p_action_id: actionId,
    p_org_id: permission.ctx.orgId,
    p_actor: permission.ctx.userId,
  } as never);

  if (error) {
    const notApprovable = error.message?.includes('action_not_approvable');
    return NextResponse.json(
      { error: notApprovable ? 'action_not_approvable' : 'approve_failed' },
      { status: notApprovable ? 409 : 500 },
    );
  }

  logger.info('action_approved', {
    correlation_id: correlationId,
    org_id: permission.ctx.orgId,
    event: 'action_approved',
    action_id: actionId,
  });

  return NextResponse.json({ status: 'approved' });
}
