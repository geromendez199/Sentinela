/**
 * Fails fast when the environment contract is incomplete. Runs in CI and before
 * every deploy; it prints which variable is missing, never its value.
 */
const REQUIRED_PUBLIC = [
  'NEXT_PUBLIC_SUPABASE_URL',
  'NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY',
  'NEXT_PUBLIC_APP_URL',
];

const REQUIRED_SERVER = [
  'SUPABASE_SECRET_KEY',
  'MELI_APP_ID',
  'MELI_CLIENT_SECRET',
  'MELI_REDIRECT_URI',
  'MELI_WEBHOOK_ROUTE_SECRET',
];

const FORBIDDEN_PUBLIC_PREFIXES = ['sb_secret_', 'APP_USR-', 'TG-'];

function main(): void {
  const missing = [...REQUIRED_PUBLIC, ...REQUIRED_SERVER].filter((name) => !process.env[name]);

  const leaked = Object.entries(process.env)
    .filter(([name]) => name.startsWith('NEXT_PUBLIC_'))
    .filter(([, value]) => FORBIDDEN_PUBLIC_PREFIXES.some((prefix) => value?.startsWith(prefix)))
    .map(([name]) => name);

  if (leaked.length > 0) {
    console.error(`Secret material in a public variable: ${leaked.join(', ')}`);
    process.exit(2);
  }

  if (missing.length > 0) {
    console.error(`Missing environment variables: ${missing.join(', ')}`);
    process.exit(1);
  }

  const redirect = process.env.MELI_REDIRECT_URI ?? '';
  if (redirect.includes('vercel.app')) {
    // Preview deployments must never be registered as a MercadoLibre redirect.
    console.error('MELI_REDIRECT_URI points at a preview domain; register a stable domain instead.');
    process.exit(3);
  }

  console.log('Environment contract satisfied.');
}

main();

export {};
