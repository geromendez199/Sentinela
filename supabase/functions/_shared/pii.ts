/**
 * PII sanitisation for the Edge runtime. Mirrors src/lib/ai/redact-pii.ts.
 * Keep both in sync: tests in tests/unit/redact-pii.test.ts pin the behaviour.
 */
const RULES: Array<{ type: string; pattern: RegExp }> = [
  { type: 'EMAIL', pattern: /[\w.+-]+@[\w-]+\.[\w.-]{2,}/g },
  { type: 'URL', pattern: /\bhttps?:\/\/\S+/gi },
  { type: 'CARD', pattern: /\b(?:\d[ -]?){13,19}\b/g },
  { type: 'CBU', pattern: /\b\d{22}\b/g },
  { type: 'PHONE', pattern: /(?:\+?\d{1,3}[\s-]?)?(?:\(?\d{2,4}\)?[\s-]?)?\d{3,4}[\s-]?\d{4}\b/g },
  { type: 'DOC', pattern: /\b(?:dni|cuit|cuil|rut|cpf|curp|cedula|nit)\s*[:#]?\s*[\d.\-/]{6,20}\b/gi },
  { type: 'ADDRESS', pattern: /\b(?:calle|av\.?|avenida|rua|street|piso|depto|dpto|apto|cp)\s+[^\n,.;]{2,40}/gi },
];

const INJECTION_PATTERNS: RegExp[] = [
  /ignore (all )?(previous|above|prior) instructions?/gi,
  /disregard (the )?(system|previous) (prompt|instructions?)/gi,
  /you are now\b/gi,
  /system\s*:/gi,
  /<\/?(system|assistant|instructions?|buyer_text)>/gi,
];

export interface Sanitized {
  text: string;
  counts: Record<string, number>;
  injectionSuspected: boolean;
}

export function sanitizeText(input: string, maxChars = 4000): Sanitized {
  let text = input
    .replace(/<[^>]+>/g, ' ')
    .replace(/&[a-z]+;/gi, ' ')
    .replace(/\s+/g, ' ')
    .trim();

  const counts: Record<string, number> = {};
  for (const rule of RULES) {
    let index = 0;
    text = text.replace(rule.pattern, (match) => {
      if (rule.type === 'PHONE' && match.replace(/\D/g, '').length < 8) return match;
      index += 1;
      counts[rule.type] = (counts[rule.type] ?? 0) + 1;
      return `<${rule.type}_${index}>`;
    });
  }

  let injectionSuspected = false;
  for (const pattern of INJECTION_PATTERNS) {
    if (pattern.test(text)) {
      injectionSuspected = true;
      text = text.replace(pattern, '[contenido removido]');
    }
    pattern.lastIndex = 0;
  }

  if (text.length > maxChars) text = `${text.slice(0, maxChars)} <TRUNCATED>`;

  return { text, counts, injectionSuspected };
}

export async function sha256Hex(value: string): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(value));
  return Array.from(new Uint8Array(digest))
    .map((byte) => byte.toString(16).padStart(2, '0'))
    .join('');
}
