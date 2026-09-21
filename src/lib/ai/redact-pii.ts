/**
 * Deterministic PII sanitisation, applied before any text reaches the LLM or the
 * embedding provider (rule 16). Placeholders are typed so the classifier keeps
 * the operational meaning without the personal data.
 *
 * The placeholder map stays in request memory only: it is never persisted and
 * never sent to the provider.
 */
export interface RedactionResult {
  text: string;
  /** In-memory only. Used to re-insert values into an approved draft. */
  map: Map<string, string>;
  counts: Record<string, number>;
  truncated: boolean;
}

interface Rule {
  type: string;
  pattern: RegExp;
}

const RULES: Rule[] = [
  { type: 'EMAIL', pattern: /[\w.+-]+@[\w-]+\.[\w.-]{2,}/g },
  { type: 'URL', pattern: /\bhttps?:\/\/\S+/gi },
  { type: 'CARD', pattern: /\b(?:\d[ -]?){13,19}\b/g },
  { type: 'CBU', pattern: /\b\d{22}\b/g },
  { type: 'PHONE', pattern: /(?:\+?\d{1,3}[\s-]?)?(?:\(?\d{2,4}\)?[\s-]?)?\d{3,4}[\s-]?\d{4}\b/g },
  { type: 'DOC', pattern: /\b(?:dni|cuit|cuil|rut|cpf|curp|cedula|nit)\s*[:#]?\s*[\d.\-/]{6,20}\b/gi },
  { type: 'ADDRESS', pattern: /\b(?:calle|av\.?|avenida|rua|street|piso|depto|dpto|apto|cp)\s+[^\n,.;]{2,40}/gi },
  { type: 'TRACKING', pattern: /\b[A-Z]{2}\d{9}[A-Z]{2}\b/g },
];

const MAX_CHARS = 4000;

function stripMarkup(text: string): string {
  return text
    .replace(/<[^>]+>/g, ' ')
    .replace(/&[a-z]+;/gi, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

export function redactPii(input: string): RedactionResult {
  let text = stripMarkup(input);
  const map = new Map<string, string>();
  const counts: Record<string, number> = {};

  for (const rule of RULES) {
    let index = 0;
    text = text.replace(rule.pattern, (match) => {
      // A short numeric run is usually a quantity, not a phone number.
      if (rule.type === 'PHONE' && match.replace(/\D/g, '').length < 8) return match;
      index += 1;
      const token = `<${rule.type}_${index}>`;
      map.set(token, match);
      counts[rule.type] = (counts[rule.type] ?? 0) + 1;
      return token;
    });
  }

  const truncated = text.length > MAX_CHARS;
  if (truncated) text = `${text.slice(0, MAX_CHARS)} <TRUNCATED>`;

  return { text, map, counts, truncated };
}

/** Re-inserts original values into an approved draft, server side only. */
export function rehydrate(text: string, map: Map<string, string>): string {
  let output = text;
  for (const [token, value] of map) output = output.split(token).join(value);
  return output;
}

/** Stable hash of sanitized text: skips re-classifying identical content. */
export async function contentHash(text: string, schemaVersion: string, model: string): Promise<string> {
  const digest = await crypto.subtle.digest(
    'SHA-256',
    new TextEncoder().encode(`${schemaVersion}|${model}|${text}`),
  );
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}
