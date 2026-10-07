import { NextResponse, type NextRequest } from 'next/server';
import { createClient } from '@/lib/supabase/server';
export async function POST(request: NextRequest) {
  if (request.headers.get('origin') !== request.nextUrl.origin) return new NextResponse(null, { status: 403 });
  const client = await createClient();
  const { error } = await client.auth.signOut();
  if (error) return NextResponse.json({ error: 'signout_failed' }, { status: 503 });
  return NextResponse.redirect(new URL('/login', request.url), 303);
}
