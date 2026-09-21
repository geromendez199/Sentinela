'use client';

import { createBrowserClient } from '@supabase/ssr';
import { clientEnv } from '@/lib/env/client';
import type { Database } from './database.types';

/** Browser client. Publishable key only, RLS enforced for every read. */
export function createClient() {
  return createBrowserClient<Database>(
    clientEnv.NEXT_PUBLIC_SUPABASE_URL,
    clientEnv.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
  );
}
