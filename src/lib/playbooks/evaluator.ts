import type { ActionType } from './action-catalog';

/**
 * Deterministic JSON rule evaluation. Rules are data, not code: an operator can
 * read exactly why a draft appeared.
 */
export type Comparison =
  | { op: 'eq'; field: string; value: string | number | boolean }
  | { op: 'neq'; field: string; value: string | number | boolean }
  | { op: 'gt'; field: string; value: number }
  | { op: 'gte'; field: string; value: number }
  | { op: 'lt'; field: string; value: number }
  | { op: 'lte'; field: string; value: number }
  | { op: 'in'; field: string; value: Array<string | number> }
  | { op: 'exists'; field: string };

export type Condition = Comparison | { op: 'and'; conditions: Condition[] } | { op: 'or'; conditions: Condition[] } | { op: 'not'; condition: Condition };

export interface PlaybookRule {
  id: string;
  name: string;
  enabled: boolean;
  triggerKind: string;
  priority: number;
  conditions: Condition;
  actions: Array<{ type: ActionType; payload?: Record<string, unknown> }>;
  requiresApproval: boolean;
}

export type EvaluationContext = Record<string, unknown>;

function readField(context: EvaluationContext, path: string): unknown {
  return path.split('.').reduce<unknown>((value, key) => {
    if (value === null || typeof value !== 'object') return undefined;
    return (value as Record<string, unknown>)[key];
  }, context);
}

export function evaluateCondition(condition: Condition, context: EvaluationContext): boolean {
  switch (condition.op) {
    case 'and':
      return condition.conditions.every((child) => evaluateCondition(child, context));
    case 'or':
      return condition.conditions.some((child) => evaluateCondition(child, context));
    case 'not':
      return !evaluateCondition(condition.condition, context);
    case 'exists':
      return readField(context, condition.field) !== undefined;
    default: {
      const actual = readField(context, condition.field);
      switch (condition.op) {
        case 'eq':
          return actual === condition.value;
        case 'neq':
          return actual !== condition.value;
        case 'gt':
          return typeof actual === 'number' && actual > condition.value;
        case 'gte':
          return typeof actual === 'number' && actual >= condition.value;
        case 'lt':
          return typeof actual === 'number' && actual < condition.value;
        case 'lte':
          return typeof actual === 'number' && actual <= condition.value;
        case 'in':
          return (
            (typeof actual === 'string' || typeof actual === 'number') &&
            (condition.value as Array<string | number>).includes(actual)
          );
        default:
          return false;
      }
    }
  }
}

export interface PlannedAction {
  ruleId: string;
  ruleName: string;
  type: ActionType;
  payload: Record<string, unknown>;
  requiresApproval: boolean;
}

/** Highest priority first; every matching rule contributes its actions. */
export function evaluatePlaybooks(
  rules: PlaybookRule[],
  triggerKind: string,
  context: EvaluationContext,
): PlannedAction[] {
  return rules
    .filter((rule) => rule.enabled && rule.triggerKind === triggerKind)
    .sort((a, b) => b.priority - a.priority)
    .filter((rule) => evaluateCondition(rule.conditions, context))
    .flatMap((rule) =>
      rule.actions.map((action) => ({
        ruleId: rule.id,
        ruleName: rule.name,
        type: action.type,
        payload: action.payload ?? {},
        // MVP: every MercadoLibre write requires approval, whatever the rule says.
        requiresApproval: rule.requiresApproval,
      })),
    );
}
