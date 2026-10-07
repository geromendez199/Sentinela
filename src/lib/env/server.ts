import 'server-only';
import { z } from 'zod';

/**
 * Server-side configuration. Importing this module from a client component is a
 * build error thanks to `server-only`.
 */
const serverEnvSchema = z.object({
  SUPABASE_SECRET_KEY: z.string().min(20),
  MELI_APP_ID: z.string().min(3),
  MELI_CLIENT_SECRET: z.string().min(8),
  MELI_REDIRECT_URI: z.string().url(),
  MELI_PKCE_ENABLED: z.enum(['true', 'false']).default('false'),
  MELI_WEBHOOK_ROUTE_SECRET: z.string().min(8),
  MELI_WRITES_ENABLED: z.enum(['true', 'false']).default('false'),
  AI_PROVIDER: z.enum(['anthropic', 'openai', 'none']).default('none'),
  AI_API_KEY: z.string().optional(),
  AI_CLASSIFIER_MODEL: z.string().optional(),
  AI_EMBEDDING_MODEL: z.string().optional(),
  AI_EMBEDDING_DIMENSIONS: z.coerce.number().int().default(1536),
  NOTIFICATIONS_PROVIDER: z.string().default('none'),
  NOTIFICATIONS_API_KEY: z.string().optional(),
  NOTIFICATIONS_FROM_EMAIL: z.string().email().optional(),
});

export type ServerEnv = z.infer<typeof serverEnvSchema>;

let cached: ServerEnv | null = null;

export function serverEnv(): ServerEnv {
  if (cached) return cached;
  cached = serverEnvSchema.parse(process.env);
  return cached;
}

/** Global kill switch. Section 0.2: the MVP never auto-executes MercadoLibre writes. */
export function meliWritesEnabled(): boolean {
  return serverEnv().MELI_WRITES_ENABLED === 'true';
}

export function pkceEnabled(): boolean {
  return serverEnv().MELI_PKCE_ENABLED === 'true';
}
