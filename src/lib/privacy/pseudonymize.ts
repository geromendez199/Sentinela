/**
 * Buyer identities never leave the system in clear form. A pseudonym is a
 * keyed hash, stable per account so history stays joinable, useless outside it.
 */
async function hmacHex(key: string, value: string): Promise<string> {
  const cryptoKey = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(key),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  );
  const signature = await crypto.subtle.sign('HMAC', cryptoKey, new TextEncoder().encode(value));
  return Array.from(new Uint8Array(signature))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

export async function pseudonymize(namespace: string, value: string | number, salt: string): Promise<string> {
  const digest = await hmacHex(salt, `${namespace}:${value}`);
  return `${namespace}_${digest.slice(0, 24)}`;
}

/** SKU hashing keeps per-SKU risk features without storing seller catalog secrets. */
export async function hashSku(sku: string, salt: string): Promise<string> {
  return (await hmacHex(salt, `sku:${sku}`)).slice(0, 32);
}
