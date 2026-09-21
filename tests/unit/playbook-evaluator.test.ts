import { describe, expect, it } from 'vitest';
import { evaluateCondition, evaluatePlaybooks, type PlaybookRule } from '@/lib/playbooks/evaluator';

const RULE: PlaybookRule = {
  id: 'rule-1',
  name: 'Riesgo alto con SLA vencido',
  enabled: true,
  triggerKind: 'risk_score',
  priority: 90,
  requiresApproval: true,
  conditions: {
    op: 'and',
    conditions: [
      { op: 'gte', field: 'risk.score', value: 0.6 },
      { op: 'in', field: 'shipment.substatus', value: ['delayed', 'stale'] },
    ],
  },
  actions: [{ type: 'DRAFT_POST_SALE_MESSAGE' }, { type: 'PRIORITIZE_DISPATCH' }],
};

describe('playbook conditions', () => {
  it('reads nested fields', () => {
    expect(evaluateCondition({ op: 'gte', field: 'risk.score', value: 0.6 }, { risk: { score: 0.7 } })).toBe(true);
  });

  it('returns false for a missing field instead of throwing', () => {
    expect(evaluateCondition({ op: 'gt', field: 'a.b.c', value: 1 }, {})).toBe(false);
  });

  it('supports not/or composition', () => {
    const context = { status: 'cancelled' };
    expect(
      evaluateCondition({ op: 'not', condition: { op: 'eq', field: 'status', value: 'cancelled' } }, context),
    ).toBe(false);
  });
});

describe('playbook evaluation', () => {
  it('emits the rule actions when every condition matches', () => {
    const planned = evaluatePlaybooks([RULE], 'risk_score', {
      risk: { score: 0.72 },
      shipment: { substatus: 'delayed' },
    });
    expect(planned.map((action) => action.type)).toEqual([
      'DRAFT_POST_SALE_MESSAGE',
      'PRIORITIZE_DISPATCH',
    ]);
  });

  it('ignores rules for another trigger or disabled ones', () => {
    expect(evaluatePlaybooks([RULE], 'claim_opened', { risk: { score: 1 } })).toHaveLength(0);
    expect(
      evaluatePlaybooks([{ ...RULE, enabled: false }], 'risk_score', {
        risk: { score: 1 },
        shipment: { substatus: 'delayed' },
      }),
    ).toHaveLength(0);
  });
});
