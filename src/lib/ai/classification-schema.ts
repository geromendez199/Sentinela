import { z } from 'zod';

/** JSON contract from section 8.2. The provider response is validated, never trusted. */
export const CLASSIFICATION_SCHEMA_VERSION = 'cls-1.0.0';

export const INTENTS = [
  'where_is_package',
  'delivery_problem',
  'product_defective',
  'product_different',
  'missing_parts',
  'wrong_variant',
  'billing',
  'cancel_request',
  'refund_request',
  'usage_question',
  'thanks',
  'other',
] as const;

export const classificationSchema = z.object({
  intent: z.enum(INTENTS),
  sentiment: z.number().min(-1).max(1),
  urgency: z.number().min(0).max(1),
  claim_risk: z.number().min(0).max(1),
  labels: z.array(z.string()).max(8),
  summary: z.string().max(280).optional(),
});

export type Classification = z.infer<typeof classificationSchema>;

export const CLASSIFICATION_JSON_SCHEMA = {
  $schema: 'https://json-schema.org/draft/2020-12/schema',
  type: 'object',
  additionalProperties: false,
  required: ['intent', 'sentiment', 'urgency', 'claim_risk', 'labels'],
  properties: {
    intent: { type: 'string', enum: [...INTENTS] },
    sentiment: { type: 'number', minimum: -1, maximum: 1 },
    urgency: { type: 'number', minimum: 0, maximum: 1 },
    claim_risk: { type: 'number', minimum: 0, maximum: 1 },
    labels: { type: 'array', items: { type: 'string' }, maxItems: 8 },
    summary: { type: 'string', maxLength: 280 },
  },
} as const;

/** Intents that map to the message_product_issue risk feature. */
export const PRODUCT_ISSUE_INTENTS = new Set([
  'product_defective',
  'product_different',
  'missing_parts',
  'wrong_variant',
]);

export const PACKAGE_INTENTS = new Set(['where_is_package', 'delivery_problem']);
