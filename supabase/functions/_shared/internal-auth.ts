import { rpc } from './db.ts';

/**
 * Authenticates pg_cron/pg_net -> Edge Function calls.
 * The high-entropy key lives only in Supabase Vault and is compared in Postgres
 * by hash through backend_verify_edge_invocation_key. It is never stored as an
 * Edge environment variable or returned to callers.
 */
export async function requireInternalInvocation(request: Request): Promise<Response | null> {
  const candidate = request.headers.get('X-Sentinela-Internal-Key');
  if (!candidate) {
    return new Response(JSON.stringify({ error: 'internal_auth_required' }), {
      status: 401,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  try {
    const valid = await rpc<boolean>('backend_verify_edge_invocation_key', {
      p_candidate: candidate,
    });
    if (!valid) {
      return new Response(JSON.stringify({ error: 'internal_auth_invalid' }), {
        status: 403,
        headers: { 'Content-Type': 'application/json' },
      });
    }
    return null;
  } catch {
    return new Response(JSON.stringify({ error: 'internal_auth_unavailable' }), {
      status: 503,
      headers: { 'Content-Type': 'application/json' },
    });
  }
}
