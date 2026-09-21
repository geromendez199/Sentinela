import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

/** Liveness probe. Never exposes configuration values. */
export async function GET() {
  return NextResponse.json({ status: 'ok', ts: new Date().toISOString() });
}
