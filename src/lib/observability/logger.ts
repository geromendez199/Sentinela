/**
 * Structured logging with a hard redaction pass. Rule 17: tokens, secrets,
 * Authorization headers and full PII payloads must never reach a log sink.
 */
type LogLevel = 'debug' | 'info' | 'warn' | 'error';

const REDACTED = '[redacted]';

const SENSITIVE_KEY = /(access_token|refresh_token|client_secret|authorization|api_key|apikey|secret|code_verifier|password|decrypted_secret|^code$)/i;

const SENSITIVE_VALUE: Array<[RegExp, string]> = [
  [/\bAPP_USR-[A-Za-z0-9-]+/g, REDACTED],
  [/\bTG-[A-Za-z0-9-]+/g, REDACTED],
  [/\bsb_secret_[A-Za-z0-9_-]+/g, REDACTED],
  [/\bBearer\s+[A-Za-z0-9._-]+/gi, `Bearer ${REDACTED}`],
  [/[\w.+-]+@[\w-]+\.[\w.-]+/g, '[email]'],
];

export function redact(value: unknown, depth = 0): unknown {
  if (depth > 6) return '[depth]';
  if (value === null || value === undefined) return value;
  if (typeof value === 'string') {
    return SENSITIVE_VALUE.reduce((acc, [re, to]) => acc.replace(re, to), value);
  }
  if (typeof value === 'number' || typeof value === 'boolean') return value;
  if (Array.isArray(value)) return value.slice(0, 50).map((v) => redact(v, depth + 1));
  if (value instanceof Error) {
    return { name: value.name, message: redact(value.message, depth + 1) };
  }
  if (typeof value === 'object') {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
      out[k] = SENSITIVE_KEY.test(k) ? REDACTED : redact(v, depth + 1);
    }
    return out;
  }
  return '[unserializable]';
}

export interface LogFields {
  correlation_id?: string;
  org_id?: string;
  meli_account_id?: string;
  event?: string;
  [key: string]: unknown;
}

function emit(level: LogLevel, message: string, fields: LogFields = {}): void {
  const line = JSON.stringify({
    ts: new Date().toISOString(),
    level,
    msg: message,
    ...(redact(fields) as Record<string, unknown>),
  });
  if (level === 'error') console.error(line);
  else if (level === 'warn') console.warn(line);
  else console.log(line);
}

export const logger = {
  debug: (m: string, f?: LogFields) => emit('debug', m, f),
  info: (m: string, f?: LogFields) => emit('info', m, f),
  warn: (m: string, f?: LogFields) => emit('warn', m, f),
  error: (m: string, f?: LogFields) => emit('error', m, f),
};
