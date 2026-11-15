import { z } from "zod";

/**
 * WooCommerce webhook payload sémák (`KG-40`).
 * Ismeretlen (és PII) mezőket a Zod alapértelmezett `strip` viselkedése eldobja.
 */

export const wooProductWebhookTopicSchema = z.enum([
  "product.created",
  "product.updated",
  "product.deleted",
  "product.restored",
]);

export const wooOrderWebhookTopicSchema = z.enum(["order.created", "order.updated"]);

export const wooWebhookTopicSchema = z.union([
  wooProductWebhookTopicSchema,
  wooOrderWebhookTopicSchema,
  z.literal("ping"),
]);

export const wooWebhookPingSchema = z.object({
  webhook_id: z.coerce.number().int().positive(),
});

export const wooWebhookCategoryRefSchema = z.object({
  id: z.number().int().positive(),
  name: z.string().optional(),
  slug: z.string().optional(),
});

export const wooWebhookProductSchema = z.object({
  id: z.number().int().positive(),
  name: z.string().optional(),
  slug: z.string().optional(),
  status: z.string().optional(),
  type: z.string().optional(),
  sku: z.string().optional(),
  categories: z.array(wooWebhookCategoryRefSchema).default([]),
});

export const wooWebhookOrderMetaSchema = z.object({
  id: z.number().int().optional(),
  key: z.string(),
  value: z.unknown(),
});

export const wooWebhookOrderSchema = z.object({
  id: z.number().int().positive(),
  number: z.string().optional(),
  order_key: z.string().optional(),
  status: z.string(),
  currency: z.string().length(3).optional(),
  total: z.string().optional(),
  payment_method: z.string().optional(),
  meta_data: z.array(wooWebhookOrderMetaSchema).default([]),
});

export type WooProductWebhookTopic = z.infer<typeof wooProductWebhookTopicSchema>;
export type WooOrderWebhookTopic = z.infer<typeof wooOrderWebhookTopicSchema>;
export type WooWebhookTopic = z.infer<typeof wooWebhookTopicSchema>;
export type WooWebhookPingPayload = z.infer<typeof wooWebhookPingSchema>;
export type WooWebhookProductPayload = z.infer<typeof wooWebhookProductSchema>;
export type WooWebhookOrderPayload = z.infer<typeof wooWebhookOrderSchema>;
