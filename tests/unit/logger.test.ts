import { describe, expect, it } from 'vitest';
import { redact } from '@/lib/observability/logger';

describe('log redaction', () => {
  it('removes token-shaped values wherever they appear', () => {
    const output = JSON.stringify(
      redact({
        access_token: 'APP_USR-123-abc',
        nested: { refresh_token: 'TG-abc123' },
        message: 'Bearer APP_USR-987',
      }),
    );
    expect(output).not.toContain('APP_USR-123');
    expect(output).not.toContain('TG-abc123');
    expect(output).not.toContain('APP_USR-987');
  });

  it('removes the authorization header and the oauth code', () => {
    const output = JSON.stringify(redact({ authorization: 'Bearer x', code: 'TG-code' }));
    expect(output).toBe('{"authorization":"[redacted]","code":"[redacted]"}');
  });

  it('masks buyer emails found in free text', () => {
    expect(redact('contacto: ana@example.com')).toBe('contacto: [email]');
  });

  it('keeps ordinary operational fields readable', () => {
    expect(redact({ order_id: 123, status: 'paid' })).toEqual({ order_id: 123, status: 'paid' });
  });
});
