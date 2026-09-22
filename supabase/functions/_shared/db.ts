import { createClient, type SupabaseClient } from 'jsr:@supabase/supabase-js@2';
import { loadSupabaseEnv } from './env.ts';

/** Privileged client. RLS is bypassed, so every query scopes org_id itself. */
export function adminClient(): SupabaseClient {
  const env = loadSupabaseEnv();
  return createClient(env.supabaseUrl, env.supabaseSecretKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

export async function rpc<T>(name: string, args: Record<string, unknown>): Promise<T> {
  const { data, error } = await adminClient().rpc(name, args);
  if (error) throw new Error(`rpc_failed:${name}:${error.code ?? 'unknown'}`);
  return data as T;
}
