/** Edge runtime configuration. Every value is a backend secret. */
export interface EdgeEnv {
  supabaseUrl: string;
  supabaseSecretKey: string;
  meliAppId: string;
  meliClientSecret: string;
  webhookRouteSecret: string;
  writesEnabled: boolean;
  aiProvider: string;
  aiApiKey: string | null;
  aiClassifierModel: string;
  notificationsProvider: string;
  notificationsApiKey: string | null;
}

function required(name: string): string {
  const value = Deno.env.get(name);
  if (!value) throw new Error(`missing_env:${name}`);
  return value;
}

export function loadEnv(): EdgeEnv {
  return {
    supabaseUrl: required('SUPABASE_URL'),
    supabaseSecretKey: required('SUPABASE_SECRET_KEY'),
    meliAppId: required('MELI_APP_ID'),
    meliClientSecret: required('MELI_CLIENT_SECRET'),
    webhookRouteSecret: required('MELI_WEBHOOK_ROUTE_SECRET'),
    writesEnabled: Deno.env.get('MELI_WRITES_ENABLED') === 'true',
    aiProvider: Deno.env.get('AI_PROVIDER') ?? 'none',
    aiApiKey: Deno.env.get('AI_API_KEY') ?? null,
    aiClassifierModel: Deno.env.get('AI_CLASSIFIER_MODEL') ?? 'claude-haiku-4-5-20251001',
    notificationsProvider: Deno.env.get('NOTIFICATIONS_PROVIDER') ?? 'none',
    notificationsApiKey: Deno.env.get('NOTIFICATIONS_API_KEY') ?? null,
  };
}
