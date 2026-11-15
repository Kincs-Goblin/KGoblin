import { z } from "zod";

/**
 * WooCommerce REST API v3 sémák (`server-only`).
 */

export const restMetaDataSchema = z.object({
  id: z.number().int().optional(),
  key: z.string(),
  value: z.unknown(),
});

export const restProductSchema = z.object({
  id: z.number().int().positive(),
  name: z.string(),
  slug: z.string(),
  type: z.string().default("simple"),
  status: z.string(),
  sku: z.string().default(""),
  price: z.string().default(""),
  regular_price: z.string().default(""),
  sale_price: z.string().default(""),
  manage_stock: z.boolean().default(false),
  stock_quantity: z.number().int().nullable().default(null),
  stock_status: z.string().default("instock"),
  meta_data: z.array(restMetaDataSchema).default([]),
});

export const restProductListSchema = z.array(restProductSchema);

export const restBatchErrorSchema = z.object({
  code: z.string(),
  message: z.string(),
  data: z
    .object({
      status: z.number().int().optional(),
    })
    .optional(),
});

export const restBatchProductItemSchema = z.union([
  restProductSchema,
  z.object({
    id: z.number().int().nonnegative(),
    error: restBatchErrorSchema,
  }),
]);

export const restProductBatchResponseSchema = z.object({
  create: z.array(restBatchProductItemSchema).default([]),
  update: z.array(restBatchProductItemSchema).default([]),
  delete: z.array(restBatchProductItemSchema).default([]),
});

export const restOrderSchema = z.object({
  id: z.number().int().positive(),
  number: z.string().default(""),
  order_key: z.string().default(""),
  status: z.string(),
  currency: z.string().length(3),
  total: z.string(),
  customer_id: z.number().int().nonnegative().default(0),
  payment_method: z.string().default(""),
  transaction_id: z.string().default(""),
  meta_data: z.array(restMetaDataSchema).default([]),
});

export const restOrderNoteSchema = z.object({
  id: z.number().int().positive(),
  note: z.string(),
  customer_note: z.boolean().default(false),
  date_created: z.string().default(""),
});

export type RestMetaData = z.infer<typeof restMetaDataSchema>;
export type RestProduct = z.infer<typeof restProductSchema>;
export type RestBatchError = z.infer<typeof restBatchErrorSchema>;
export type RestBatchProductItem = z.infer<typeof restBatchProductItemSchema>;
export type RestProductBatchResponse = z.infer<typeof restProductBatchResponseSchema>;
export type RestOrder = z.infer<typeof restOrderSchema>;
export type RestOrderNote = z.infer<typeof restOrderNoteSchema>;
