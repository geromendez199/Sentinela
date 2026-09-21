import { z } from 'zod';

/**
 * External response schemas.
 *
 * Contract rule (section 3.1): an unknown new field must never break the
 * parser, but a missing required field must raise. Every object is therefore
 * `passthrough()` with only the fields Sentinela depends on marked required.
 */

export const sellerReputationMetricSchema = z
  .object({
    period: z.string().optional(),
    rate: z.number().optional(),
    value: z.number().optional(),
    excluded: z.object({ real_value: z.number().optional(), real_rate: z.number().optional() }).passthrough().nullish(),
  })
  .passthrough();

export const sellerReputationSchema = z
  .object({
    level_id: z.string().nullish(),
    power_seller_status: z.string().nullish(),
    transactions: z.object({ period: z.string().optional(), completed: z.number().optional() }).passthrough().optional(),
    metrics: z
      .object({
        claims: sellerReputationMetricSchema.optional(),
        cancellations: sellerReputationMetricSchema.optional(),
        delayed_handling_time: sellerReputationMetricSchema.optional(),
        sales: z.object({ period: z.string().optional(), completed: z.number().optional() }).passthrough().optional(),
      })
      .passthrough()
      .optional(),
  })
  .passthrough();

export const meliUserSchema = z
  .object({
    id: z.number(),
    nickname: z.string().optional(),
    site_id: z.string().optional(),
    seller_reputation: sellerReputationSchema.optional(),
  })
  .passthrough();

export const meliOrderSchema = z
  .object({
    id: z.number(),
    status: z.string(),
    last_updated: z.string(),
    date_created: z.string(),
    tags: z.array(z.string()).optional(),
    pack_id: z.number().nullish(),
    shipping: z.object({ id: z.number().nullish() }).passthrough().optional(),
    order_items: z.array(z.unknown()).optional(),
  })
  .passthrough();

export const meliOrdersSearchSchema = z
  .object({
    results: z.array(meliOrderSchema),
    paging: z.object({ total: z.number(), offset: z.number(), limit: z.number() }).passthrough(),
  })
  .passthrough();

export const meliShipmentSchema = z
  .object({
    id: z.number(),
    status: z.string().optional(),
    substatus: z.string().nullish(),
    last_updated: z.string().optional(),
  })
  .passthrough();

export const meliShipmentSlaSchema = z
  .object({
    status: z.string().optional(),
    service: z.string().optional(),
    expected_date: z.string().optional(),
    last_updated: z.string().optional(),
  })
  .passthrough();

export const meliClaimSchema = z
  .object({
    id: z.union([z.number(), z.string()]),
    status: z.string().optional(),
    stage: z.string().optional(),
    type: z.string().optional(),
    date_created: z.string().optional(),
    last_updated: z.string().optional(),
    resource_id: z.union([z.number(), z.string()]).optional(),
    reason_id: z.string().nullish(),
  })
  .passthrough();

export const meliClaimsSearchSchema = z
  .object({
    data: z.array(meliClaimSchema),
    paging: z.object({ total: z.number(), offset: z.number(), limit: z.number() }).passthrough(),
  })
  .passthrough();

export const meliAffectsReputationSchema = z
  .object({
    affects_reputation: z.boolean().optional(),
    reason: z.string().nullish(),
    last_updated: z.string().nullish(),
  })
  .passthrough();

export const meliMessagesResponseSchema = z
  .object({
    conversation_status: z
      .object({ status: z.string().optional(), blocked: z.boolean().optional(), substatus: z.string().nullish() })
      .passthrough()
      .optional(),
    messages: z
      .array(
        z
          .object({
            id: z.string(),
            text: z.string().nullish(),
            from: z.object({ user_id: z.union([z.string(), z.number()]).optional(), role: z.string().optional() }).passthrough().optional(),
            message_date: z.object({ created: z.string().optional(), received: z.string().optional() }).passthrough().optional(),
          })
          .passthrough(),
      )
      .optional(),
  })
  .passthrough();

export const meliActionGuideSchema = z
  .object({
    status: z.string().optional(),
    blocked: z.boolean().optional(),
    options: z
      .array(z.object({ id: z.string().optional(), text: z.string().optional(), template_id: z.string().optional() }).passthrough())
      .optional(),
  })
  .passthrough();

export const meliItemSchema = z
  .object({
    id: z.string(),
    title: z.string().optional(),
    status: z.string().optional(),
    category_id: z.string().optional(),
    last_updated: z.string().optional(),
    available_quantity: z.number().optional(),
  })
  .passthrough();

export const meliQuestionSchema = z
  .object({
    id: z.number(),
    item_id: z.string().optional(),
    status: z.string().optional(),
    text: z.string().nullish(),
    date_created: z.string().optional(),
  })
  .passthrough();

export const meliUserProductStockSchema = z
  .object({
    total: z.number().optional(),
    last_updated: z.string().optional(),
    locations: z.array(z.object({ type: z.string().optional(), quantity: z.number().optional() }).passthrough()).optional(),
  })
  .passthrough();

/** Webhook envelope. The payload is a change pointer, never trusted state. */
export const meliWebhookSchema = z
  .object({
    _id: z.string().optional(),
    resource: z.string(),
    user_id: z.union([z.number(), z.string()]),
    topic: z.string(),
    application_id: z.union([z.number(), z.string()]),
    attempts: z.number().optional(),
    sent: z.string().optional(),
    received: z.string().optional(),
    actions: z.array(z.string()).optional(),
  })
  .passthrough();

export type MeliWebhookEnvelope = z.infer<typeof meliWebhookSchema>;
