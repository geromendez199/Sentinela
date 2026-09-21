import { NextResponse, type NextRequest } from 'next/server';
import { z } from 'zod';
import { checkPermission } from '@/lib/auth/require-role';
import { createAdminClient } from '@/lib/supabase/admin';

export const dynamic = 'force-dynamic';

const bodySchema = z.object({ orgSlug: z.string().min(2) });

export async function POST(request: NextRequest, context: { params: Promise<{ actionId: string }> }) {
  const { actionId } = await context.params;
  const parsed = bodySchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: 'invalid_request' }, { status: 400 });

  const permission = await checkPermission(parsed.data.orgSlug, 'actions:approve');
  if (!permission.ok) return NextResponse.json({ error: 'forbidden' }, { status: permission.status });

  const supabase = createAdminClient();
  const { error } = await supabase.rpc('backend_cancel_action' as never, {
    p_action_id: actionId,
    p_org_id: permission.ctx.orgId,
    p_actor: permission.ctx.userId,
  } as never);

  if (error) return NextResponse.json({ error: 'action_not_cancellable' }, { status: 409 });
  return NextResponse.json({ status: 'cancelled' });
}
