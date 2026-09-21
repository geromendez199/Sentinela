const SENSITIVE_KEY = /(access_token|refresh_token|client_secret|authorization|api_key|secret|^code$)/i;

function redact(value: unknown, depth = 0): unknown {
  if (depth > 5) return '[depth]';
  if (value === null || value === undefined) return value;
  if (typeof value === 'string') {
    return value
      .replace(/\bAPP_USR-[A-Za-z0-9-]+/g, '[redacted]')
      .replace(/\bTG-[A-Za-z0-9-]+/g, '[redacted]')
      .replace(/[\w.+-]+@[\w-]+\.[\w.-]+/g, '[email]');
  }
  if (typeof value !== 'object') return value;
  if (Array.isArray(value)) return value.slice(0, 30).map((item) => redact(item, depth + 1));
  const out: Record<string, unknown> = {};
  for (const [key, item] of Object.entries(value as Record<string, unknown>)) {
    out[key] = SENSITIVE_KEY.test(key) ? '[redacted]' : redact(item, depth + 1);
  }
  return out;
}

export function log(
  level: 'info' | 'warn' | 'error',
  message: string,
  fields: Record<string, unknown> = {},
): void {
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
