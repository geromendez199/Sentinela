import { NextResponse, type NextRequest } from 'next/server';
import { z } from 'zod';
import { checkPermission } from '@/lib/auth/require-role';
import { createAdminClient } from '@/lib/supabase/admin';

const bodySchema = z.object({ orgSlug: z.string().min(2) });

export async function POST(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  const body = bodySchema.safeParse(await request.json().catch(() => null));
  const parsedId = Number(id);
  if (!body.success || !Number.isSafeInteger(parsedId) || parsedId <= 0) return NextResponse.json({ error: 'invalid_request' }, { status: 400 });

  const permission = await checkPermission(body.data.orgSlug, 'org:update');
  if (!permission.ok) return NextResponse.json({ error: 'forbidden' }, { status: permission.status });
  const supabase = createAdminClient();
  const { data, error } = await supabase.rpc('backend_retry_dead_letter' as never, {
    p_dead_letter_id: parsedId,
    p_org_id: permission.ctx.orgId,
    p_actor: permission.ctx.userId,
  } as never);
  if (error) return NextResponse.json({ error: 'dead_letter_not_retryable' }, { status: 409 });
  return NextResponse.json({ message_id: data });
}
