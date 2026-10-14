import { NextResponse, type NextRequest } from 'next/server';
import { z } from 'zod';
import { createHash } from 'node:crypto';
import { checkPermission } from '@/lib/auth/require-role';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { numericSearch } from '@/lib/ui/list-query';
import { redactPii } from '@/lib/ai/redact-pii';
import { validateSupportDraft } from '@/lib/support/triage';

const schema = z.object({ orgSlug: z.string().min(2).max(100), accountId: z.string().uuid(), source: z.enum(['question','message','claim']), resourceId: z.string().min(1).max(100), text: z.string().trim().min(3).max(2000) });
export async function POST(request: NextRequest) {
  if(request.headers.get('origin')&&request.headers.get('origin')!==request.nextUrl.origin)return NextResponse.json({error:'forbidden_origin'},{status:403});
  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: 'invalid_request' }, { status: 400 });
  const body = parsed.data;
  const permission = await checkPermission(body.orgSlug, 'actions:approve');
  if (!permission.ok) return NextResponse.json({ error: 'forbidden' }, { status: permission.status });
  const issues = validateSupportDraft(body.text, body.source === 'question' ? 2000 : 350);
  if (issues.length) return NextResponse.json({ error: 'policy_review', issues }, { status: 422 });
  const supabase = await createClient();
  const scope = { orgId: permission.ctx.orgId, accountId: body.accountId };
  let itemId: string | null = null, orderId: number | null = null, packId: number | null = null, claimId: number | null = null;
  if (body.source === 'question') {
    const { data, error } = await supabase.from('questions').select('item_id').eq('org_id', scope.orgId).eq('meli_account_id', scope.accountId).eq('question_id', numericSearch(body.resourceId)).maybeSingle();
    if (error) return NextResponse.json({error:'resource_load_failed'},{status:503});
    if (!data) return NextResponse.json({error:'not_found'},{status:404});
    itemId = data.item_id;
  } else if (body.source === 'message') {
    const { data, error } = await supabase.from('messages').select('order_id, pack_id, actor_role').eq('org_id', scope.orgId).eq('meli_account_id', scope.accountId).eq('message_id', body.resourceId).maybeSingle();
    if (error) return NextResponse.json({error:'resource_load_failed'},{status:503});
    if (!data || data.actor_role !== 'buyer') return NextResponse.json({error:'not_found'},{status:404});
    orderId = data.order_id; packId = data.pack_id;
  } else {
    const { data, error } = await supabase.from('claims').select('claim_id, order_id, pack_id').eq('org_id', scope.orgId).eq('meli_account_id', scope.accountId).eq('claim_id', numericSearch(body.resourceId)).maybeSingle();
    if (error) return NextResponse.json({error:'resource_load_failed'},{status:503});
    if (!data) return NextResponse.json({error:'not_found'},{status:404});
    claimId = data.claim_id; orderId = data.order_id; packId = data.pack_id;
  }
  const text = redactPii(body.text).text;
  const hash = createHash('sha256').update(JSON.stringify([scope.orgId,scope.accountId,body.source,body.resourceId,text])).digest('hex');
  const admin = createAdminClient();
  const { data, error } = await admin.from('action_drafts').insert({ org_id:scope.orgId, meli_account_id:scope.accountId, kind:body.source === 'claim' ? 'DRAFT_CLAIM_RESPONSE' : 'DRAFT_POST_SALE_MESSAGE', order_id:orderId, pack_id:packId, claim_id:claimId, item_id:itemId, rendered_text:text, payload_sanitized:{source:body.source,source_id:body.resourceId,manual_use_only:true}, status:'draft', requires_approval:true, created_by_system:false, created_by_user:permission.ctx.userId, idempotency_key:'support-v2:' + hash }).select('id').single();
  if (error?.code === '23505') {
    const existing = await admin.from('action_drafts').select('id').eq('org_id',scope.orgId).eq('idempotency_key','support-v2:' + hash).maybeSingle();
    if (existing.data) return NextResponse.json({id:existing.data.id,replayed:true});
  }
  if (error) return NextResponse.json({error:'draft_save_failed'},{status:503});
  return NextResponse.json({id:data.id},{status:201});
}
