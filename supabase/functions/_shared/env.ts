/** Edge runtime configuration. Read only the secrets a capability actually needs. */

function required(name: string): string {
  const value = Deno.env.get(name);
  if (!value) throw new Error(`missing_env:${name}`);
  return value;
}

function requiredOneOf(names: readonly string[]): string {
  for (const name of names) {
    const value = Deno.env.get(name);
    if (value) return value;
  }
  throw new Error(`missing_env:${names.join('|')}`);
}

export interface SupabaseEnv {
  supabaseUrl: string;
  supabaseSecretKey: string;
}

export interface MeliOAuthEnv {
  meliAppId: string;
  meliClientSecret: string;
}

export interface WebhookEnv {
  meliAppId: string;
  webhookRouteSecret: string;
}

export interface AiEnv {
  aiProvider: string;
  aiApiKey: string | null;
  aiClassifierModel: string;
}

export interface NotificationsEnv {
  notificationsProvider: string;
  notificationsApiKey: string | null;
  notificationsFromEmail: string | null;
}

export function loadSupabaseEnv(): SupabaseEnv {
  return {
    supabaseUrl: required('SUPABASE_URL'),
    supabaseSecretKey: requiredOneOf(['SUPABASE_SECRET_KEY', 'SUPABASE_SERVICE_ROLE_KEY']),
  };
}

export function loadMeliOAuthEnv(): MeliOAuthEnv {
  return {
    meliAppId: required('MELI_APP_ID'),
    meliClientSecret: required('MELI_CLIENT_SECRET'),
  };
}

export function loadWebhookEnv(): WebhookEnv {
  return {
    meliAppId: required('MELI_APP_ID'),
    webhookRouteSecret: required('MELI_WEBHOOK_ROUTE_SECRET'),
  };
}

export function loadWritePolicyEnv(): { writesEnabled: boolean } {
  return { writesEnabled: Deno.env.get('MELI_WRITES_ENABLED') === 'true' };
}

export function loadAiEnv(): AiEnv {
  return {
    aiProvider: Deno.env.get('AI_PROVIDER') ?? 'none',
    aiApiKey: Deno.env.get('AI_API_KEY') ?? null,
    aiClassifierModel: Deno.env.get('AI_CLASSIFIER_MODEL') ?? 'claude-haiku-4-5-20251001',
  };
}

export function loadNotificationsEnv(): NotificationsEnv {
  return {
    notificationsProvider: Deno.env.get('NOTIFICATIONS_PROVIDER') ?? 'none',
    notificationsApiKey: Deno.env.get('NOTIFICATIONS_API_KEY') ?? null,
    notificationsFromEmail: Deno.env.get('NOTIFICATIONS_FROM_EMAIL') ?? null,
  };
}
