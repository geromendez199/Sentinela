/**
 * Site configuration. The per-country authorization host is part of the OAuth
 * contract; the token endpoint is common (section 3.2).
 */
export const SUPPORTED_SITES = ['MLA', 'MLB', 'MLM', 'MLC', 'MCO', 'MLU'] as const;
export type SiteId = (typeof SUPPORTED_SITES)[number];

export function isSiteId(value: string): value is SiteId {
  return (SUPPORTED_SITES as readonly string[]).includes(value);
}

interface SiteConfig {
  readonly authHost: string;
  readonly country: string;
  readonly currency: string;
  /** Verified against official documentation on 2026-09-21. */
  readonly authHostVerified: boolean;
}

export const SITE_CONFIG: Record<SiteId, SiteConfig> = {
  MLA: { authHost: 'https://auth.mercadolibre.com.ar', country: 'AR', currency: 'ARS', authHostVerified: true },
  MLB: { authHost: 'https://auth.mercadolivre.com.br', country: 'BR', currency: 'BRL', authHostVerified: true },
  // [NO VERIFICADO] host confirmed only by the published country-host pattern;
  // scripts/verify-meli-contracts.ts probes each host before enabling the site.
  MLM: { authHost: 'https://auth.mercadolibre.com.mx', country: 'MX', currency: 'MXN', authHostVerified: false },
  MLC: { authHost: 'https://auth.mercadolibre.cl', country: 'CL', currency: 'CLP', authHostVerified: false },
  MCO: { authHost: 'https://auth.mercadolibre.com.co', country: 'CO', currency: 'COP', authHostVerified: false },
  MLU: { authHost: 'https://auth.mercadolibre.com.uy', country: 'UY', currency: 'UYU', authHostVerified: false },
};

export const MELI_API_BASE = 'https://api.mercadolibre.com';
export const MELI_TOKEN_URL = `${MELI_API_BASE}/oauth/token`;

export function authorizationUrl(site: SiteId, params: Record<string, string>): string {
  const url = new URL('/authorization', SITE_CONFIG[site].authHost);
  for (const [key, value] of Object.entries(params)) url.searchParams.set(key, value);
  return url.toString();
}
