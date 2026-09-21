import { NextResponse, type NextRequest } from 'next/server';
import { z } from 'zod';
import { checkPermission } from '@/lib/auth/require-role';
import { meliWritesEnabled } from '@/lib/env/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { isMeliWrite, type ActionType } from '@/lib/playbooks/action-catalog';
import { logger } from '@/lib/observability/logger';
import { correlationFromHeaders } from '@/lib/observability/correlation';

export const dynamic = 'force-dynamic';

const bodySchema = z.object({ orgSlug: z.string().min(2) });

/**
 * Hands an approved draft to the execute-approved-action worker.
 *
 * The route never calls MercadoLibre itself: the write happens in an Edge
 * Function that holds the token, the rate budget and the final policy check.
 */
export async function POST(request: NextRequest, context: { params: Promise<{ actionId: string }> }) {
  const { actionId } = await context.params;
  const correlationId = correlationFromHeaders(request.headers);

  const parsed = bodySchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: 'invalid_request' }, { status: 400 });

  const permission = await checkPermission(parsed.data.orgSlug, 'actions:execute');
  if (!permission.ok) return NextResponse.json({ error: 'forbidden' }, { status: permission.status });

  const supabase = createAdminClient();
  const { data: draft } = await supabase
    .from('action_drafts')
    .select('id, status, kind, meli_account_id')
    .eq('id', actionId)
    .eq('org_id', permission.ctx.orgId)
    .maybeSingle();

  if (!draft) return NextResponse.json({ error: 'not_found' }, { status: 404 });
  if (draft.status !== 'approved') {
    return NextResponse.json({ error: 'action_not_approved' }, { status: 409 });
  }

  // Fail fast on the global kill switch; the worker re-checks it anyway.
  if (isMeliWrite(draft.kind as ActionType) && !meliWritesEnabled()) {
    return NextResponse.json({ error: 'writes_disabled_globally' }, { status: 409 });
  }

  const { error } = await supabase.rpc('backend_enqueue_action_execution' as never, {
    p_action_id: actionId,
    p_org_id: permission.ctx.orgId,
    p_actor: permission.ctx.userId,
    p_correlation_id: correlationId,
  } as never);

  if (error) return NextResponse.json({ error: 'enqueue_failed' }, { status: 500 });

  logger.info('action_execution_enqueued', {
    correlation_id: correlationId,
    org_id: permission.ctx.orgId,
    meli_account_id: draft.meli_account_id,
    event: 'action_execution_enqueued',
  });

  return NextResponse.json({ status: 'queued' });
}
