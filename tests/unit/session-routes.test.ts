import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';
import { POST } from '@/app/(auth)/auth/signout/route';
import { GET } from '@/app/(auth)/auth/callback/route';
const mocks=vi.hoisted(()=>({signOut:vi.fn(),exchange:vi.fn(),client:vi.fn()}));
vi.mock('@/lib/supabase/server',()=>({createClient:mocks.client}));
beforeEach(()=>{vi.clearAllMocks();mocks.signOut.mockResolvedValue({error:null});mocks.exchange.mockResolvedValue({error:null});mocks.client.mockResolvedValue({auth:{signOut:mocks.signOut,exchangeCodeForSession:mocks.exchange}});});
describe('session endpoints',()=>{
 it('rejects cross-origin signout before calling Supabase',async()=>{const response=await POST(new NextRequest('https://app.test/auth/signout',{method:'POST',headers:{Origin:'https://other.test'}}));expect(response.status).toBe(403);expect(mocks.client).not.toHaveBeenCalled();});
 it('signs out using POST and redirects to login',async()=>{const response=await POST(new NextRequest('https://app.test/auth/signout',{method:'POST',headers:{Origin:'https://app.test'}}));expect(response.status).toBe(303);expect(mocks.signOut).toHaveBeenCalledOnce();expect(response.headers.get('location')).toBe('https://app.test/login');});
 it('keeps auth callback redirects inside the app',async()=>{const response=await GET(new NextRequest('https://app.test/auth/callback?code=test&next=https://other.test'));expect(response.headers.get('location')).toBe('https://app.test/');});
 it('does not redirect to protected destination after invalid code',async()=>{mocks.exchange.mockResolvedValue({error:{message:'expired'}});const response=await GET(new NextRequest('https://app.test/auth/callback?code=test&next=/team'));expect(response.headers.get('location')).toBe('https://app.test/login?error=auth_exchange_failed');});
});
