import 'server-only';
import { createClient as createSupabaseClient } from '@supabase/supabase-js';
import { clientEnv } from '@/lib/env/client';
import { serverEnv } from '@/lib/env/server';
import type { Database } from './database.types';

/**
 * Privileged backend client (sb_secret_*). Bypasses RLS, so every call site must
 * scope queries by org_id explicitly and must never return MercadoLibre tokens
 * to a browser response.
 */
export function createAdminClient() {
  return createSupabaseClient<Database>(
    clientEnv.NEXT_PUBLIC_SUPABASE_URL,
    serverEnv().SUPABASE_SECRET_KEY,
    { auth: { persistSession: false, autoRefreshToken: false } },
  );
}
