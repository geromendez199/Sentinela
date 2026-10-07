import { describe, expect, it } from 'vitest';
import { getSlaStatus } from '@/lib/support/sla';

describe('SLA status', () => {
  const now = new Date('2026-01-01T12:00:00Z');
  it('marks overdue work explicitly', () => expect(getSlaStatus('2026-01-01T11:59:00Z', now).state).toBe('overdue'));
  it('marks the final two hours urgent', () => expect(getSlaStatus('2026-01-01T13:30:00Z', now).state).toBe('urgent'));
  it('does not invent a deadline', () => expect(getSlaStatus(null, now).state).toBe('unknown'));
});
