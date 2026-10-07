import { NextResponse, type NextRequest } from 'next/server';
import { z } from 'zod';
import { checkPermission } from '@/lib/auth/require-role';
import { createAdminClient } from '@/lib/supabase/admin';

export const dynamic = 'force-dynamic';

const bodySchema = z.object({ orgSlug: z.string().min(2) });

export async function POST(request: NextRequest, context: { params: Promise<{ alertId: string }> }) {
  const { alertId } = await context.params;
  const parsed = bodySchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: 'invalid_request' }, { status: 400 });

  const permission = await checkPermission(parsed.data.orgSlug, 'alerts:ack');
  if (!permission.ok) return NextResponse.json({ error: 'forbidden' }, { status: permission.status });

  const supabase = createAdminClient();
  const { error } = await supabase.rpc('backend_acknowledge_alert' as never, {
    p_alert_id: alertId,
    p_org_id: permission.ctx.orgId,
    p_actor: permission.ctx.userId,
  } as never);

  if (error) {
    const { data: existing } = await supabase
      .from('alerts')
      .select('status')
      .eq('id', alertId)
      .eq('org_id', permission.ctx.orgId)
      .maybeSingle();
    if (existing?.status === 'acknowledged' || existing?.status === 'resolved') {
      return NextResponse.json({ status: existing.status, replayed: true });
    }
    return NextResponse.json({ error: 'alert_not_open' }, { status: 409 });
  }
  return NextResponse.json({ status: 'acknowledged' });
}
