/** Accept only paths on this application's origin, including after URL normalization. */
export function safeRedirectPath(value: string | null | undefined, fallback = '/'): string {
  if (!value || !value.startsWith('/') || value.startsWith('//') || /[\\\u0000-\u0020]/.test(value)) return fallback;
  const base = new URL('https://sentinela.invalid');
  try {
    const target = new URL(value, base);
    return target.origin === base.origin ? `${target.pathname}${target.search}${target.hash}` : fallback;
  } catch { return fallback; }
}
