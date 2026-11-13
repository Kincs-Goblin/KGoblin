import { z } from "zod";

/**
 * Store API-sémák. Csak a használt mezők; az ismeretlen mezőket a Zod alapból elhagyja (strip).
 * Hiányzó kötelező mező: `WOO.CONTRACT_MISMATCH`.
 */

/** Az árak minor unitban, stringként jönnek (pl. "16990" HUF-nál 0 tizedessel). */
const minorAmount = z.string().regex(/^\d+$/);

export const priceSchema = z.object({
  price: minorAmount,
  regular_price: minorAmount,
  sale_price: minorAmount,
  currency_code: z.string().length(3),
  currency_minor_unit: z.number().int().min(0),
});

export const imageSchema = z.object({
  id: z.number(),
  src: z.string().url(),
  thumbnail: z.string().url().optional(),
  alt: z.string().default(""),
  name: z.string().default(""),
});

export const termSchema = z.object({
  id: z.number(),
  name: z.string(),
  slug: z.string(),
});

/** A saját `kg-headless` plugin Store API-kiterjesztése; régebbi backendnél hiányozhat. */
export const kgHeadlessExtensionSchema = z
  .object({
    lowest_price_30_days: z.number().int().nonnegative().nullable(),
    is_on_sale: z.boolean(),
  })
  .partial();

export const productSchema = z.object({
  id: z.number(),
  name: z.string(),
  slug: z.string(),
  sku: z.string().default(""),
  short_description: z.string().default(""),
  description: z.string().default(""),
  on_sale: z.boolean(),
  prices: priceSchema,
  images: z.array(imageSchema),
  categories: z.array(termSchema),
  tags: z.array(termSchema),
  is_purchasable: z.boolean(),
  is_in_stock: z.boolean(),
  low_stock_remaining: z.number().int().nullable(),
  extensions: z
    .object({
      kg_headless: kgHeadlessExtensionSchema.optional(),
    })
    .default({}),
});

export const productListSchema = z.array(productSchema);

export const categorySchema = z.object({
  id: z.number(),
  name: z.string(),
  slug: z.string(),
  description: z.string().default(""),
  parent: z.number(),
  count: z.number().int(),
  image: imageSchema.nullable(),
});

export const categoryListSchema = z.array(categorySchema);

export type StorePrice = z.infer<typeof priceSchema>;
export type StoreImage = z.infer<typeof imageSchema>;
export type StoreProduct = z.infer<typeof productSchema>;
export type StoreCategory = z.infer<typeof categorySchema>;
