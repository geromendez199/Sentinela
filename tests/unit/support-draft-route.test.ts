import { beforeEach,describe,it,expect,vi } from 'vitest';
import { NextRequest } from 'next/server';
import { POST } from '@/app/api/support/drafts/route';
const mocks=vi.hoisted(()=>({permission:vi.fn(),client:vi.fn(),admin:vi.fn(),insert:vi.fn(),eq:vi.fn(),source:vi.fn(),saved:vi.fn()}));
vi.mock('@/lib/auth/require-role',()=>({checkPermission:mocks.permission}));
vi.mock('@/lib/supabase/server',()=>({createClient:mocks.client}));
vi.mock('@/lib/supabase/admin',()=>({createAdminClient:mocks.admin}));
const body={orgSlug:'team',accountId:'11111111-1111-4111-8111-111111111111',source:'question',resourceId:'123',text:'Hola, vamos a verificar esa información.'};
const request=(data=body,origin='https://app.test')=>new NextRequest('https://app.test/api/support/drafts',{method:'POST',headers:{'Content-Type':'application/json',Origin:origin},body:JSON.stringify(data)});
beforeEach(()=>{
  vi.clearAllMocks();
  mocks.permission.mockResolvedValue({ok:true,ctx:{orgId:'org-a',userId:'actor-a'}});
  mocks.source.mockResolvedValue({data:{item_id:'MLA123'},error:null});
  const reader={select:vi.fn().mockReturnThis(),eq:mocks.eq,maybeSingle:mocks.source};
  mocks.eq.mockReturnValue(reader);mocks.client.mockResolvedValue({from:vi.fn().mockReturnValue(reader)});
  mocks.saved.mockResolvedValue({data:{id:'draft-a'},error:null});
  const writer={insert:mocks.insert,select:vi.fn().mockReturnThis(),eq:vi.fn().mockReturnThis(),maybeSingle:vi.fn().mockResolvedValue({data:{id:'existing-draft'},error:null}),single:mocks.saved};mocks.insert.mockReturnValue(writer);mocks.admin.mockReturnValue({from:vi.fn().mockReturnValue(writer)});
});
describe('support draft authorization',()=>{
  it('rejects cross-origin requests before database access',async()=>{expect((await POST(request(body,'https://other.test'))).status).toBe(403);expect(mocks.permission).not.toHaveBeenCalled();});
  it('rejects a viewer before creating an admin client',async()=>{mocks.permission.mockResolvedValue({ok:false,status:403});expect((await POST(request())).status).toBe(403);expect(mocks.admin).not.toHaveBeenCalled();});
  it('requires a resource in the selected tenant/account',async()=>{mocks.source.mockResolvedValue({data:null,error:null});expect((await POST(request())).status).toBe(404);expect(mocks.eq).toHaveBeenCalledWith('org_id','org-a');expect(mocks.eq).toHaveBeenCalledWith('meli_account_id',body.accountId);expect(mocks.admin).not.toHaveBeenCalled();});
  it('saves only a draft with actor and deterministic idempotency',async()=>{expect((await POST(request())).status).toBe(201);const first=mocks.insert.mock.calls[0]?.[0];expect(first).toMatchObject({status:'draft',created_by_system:false,created_by_user:'actor-a',requires_approval:true,payload_sanitized:{manual_use_only:true}});await POST(request());expect(mocks.insert.mock.calls[1]?.[0].idempotency_key).toBe(first.idempotency_key);});
  it('blocks external contacts before resource lookup',async()=>{expect((await POST(request({...body,text:'Escribime a https://other.test'}))).status).toBe(422);expect(mocks.client).not.toHaveBeenCalled();});
  it('replays a duplicate without creating another draft',async()=>{mocks.saved.mockResolvedValue({data:null,error:{code:'23505'}});const response=await POST(request());expect(response.status).toBe(200);expect(await response.json()).toEqual({id:'existing-draft',replayed:true});});
});
