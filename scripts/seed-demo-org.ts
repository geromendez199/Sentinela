/**
 * Seeds a demo organization for local development. Never run against
 * production: it creates synthetic data only, with no real buyer information.
 */
import { createClient } from '@supabase/supabase-js';

async function main(): Promise<void> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SECRET_KEY;
  const email = process.env.DEMO_USER_EMAIL ?? 'demo@sentinela.local';
  const password = process.env.DEMO_USER_PASSWORD;

  if (!url || !key || !password) {
    console.error('NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SECRET_KEY and DEMO_USER_PASSWORD are required.');
    process.exit(1);
  }
  if (url.includes('supabase.co') && process.env.ALLOW_REMOTE_SEED !== 'true') {
    console.error('Refusing to seed a hosted project without ALLOW_REMOTE_SEED=true.');
    process.exit(2);
  }

  const supabase = createClient(url, key, { auth: { persistSession: false } });

  const { data: user, error: userError } = await supabase.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
  });
  if (userError && !userError.message.includes('already')) throw userError;

  const userId = user?.user?.id;
  if (!userId) {
    console.error('Could not resolve the demo user id.');
    process.exit(3);
  }

  const { data: org, error: orgError } = await supabase
    .from('organizations')
    .insert({ name: 'Demo Sentinela', slug: 'demo-sentinela', created_by: userId })
    .select('id')
    .maybeSingle();
  if (orgError) throw orgError;

  await supabase
    .from('organization_members')
    .insert({ org_id: org?.id, user_id: userId, role: 'owner' });

  console.log(`Demo organization ready: /demo-sentinela (owner ${email})`);
}

void main();
