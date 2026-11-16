import { z } from "zod";

/**
 * Store API-sémák. Csak a használt mezők; az ismeretlen mezőket a Zod alapból elhagyja (strip).
 * Hiányzó kötelező mező: `WOO.CONTRACT_MISMATCH`.
 */

/** Az árak minor unitban, stringként jönnek (pl. "16990" HUF-nál 0 tizedessel). */
const minorAmount = z.string().regex(/^\d+$/);
const signedMinorAmount = z.string().regex(/^-?\d+$/);

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
    currency_minor_unit: z.number().int().min(0).optional(),
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

export const attributeSchema = z.object({
  id: z.number(),
  name: z.string(),
  taxonomy: z.string().default(""),
  slug: z.string().optional(),
  type: z.string().default("select"),
  order: z.string().default("menu_order"),
  has_archives: z.boolean().default(false),
});

export const attributeListSchema = z.array(attributeSchema);

export const attributeTermSchema = z.object({
  id: z.number(),
  name: z.string(),
  slug: z.string(),
  description: z.string().default(""),
  menu_order: z.number().int().default(0),
  count: z.number().int().default(0),
});

export const attributeTermListSchema = z.array(attributeTermSchema);

export const cartItemVariationSchema = z.object({
  attribute: z.string(),
  value: z.string(),
});

export const cartItemTotalsSchema = z.object({
  line_subtotal: signedMinorAmount,
  line_subtotal_tax: signedMinorAmount,
  line_total: signedMinorAmount,
  line_total_tax: signedMinorAmount,
  currency_code: z.string().length(3),
  currency_minor_unit: z.number().int().min(0),
});

export const cartItemSchema = z.object({
  key: z.string().min(1),
  id: z.number().int().positive(),
  quantity: z.number().int().min(0),
  name: z.string(),
  slug: z.string().default(""),
  sku: z.string().default(""),
  short_description: z.string().default(""),
  prices: priceSchema,
  totals: cartItemTotalsSchema,
  images: z.array(imageSchema).default([]),
  variation: z.array(cartItemVariationSchema).default([]),
});

export const cartCouponTotalsSchema = z.object({
  total_discount: signedMinorAmount,
  total_discount_tax: signedMinorAmount,
  currency_code: z.string().length(3),
  currency_minor_unit: z.number().int().min(0),
});

export const cartCouponSchema = z.object({
  code: z.string().min(1),
  discount_type: z.string().default(""),
  totals: cartCouponTotalsSchema,
});

export const cartTotalsSchema = z.object({
  total_items: signedMinorAmount,
  total_items_tax: signedMinorAmount,
  total_fees: signedMinorAmount,
  total_fees_tax: signedMinorAmount,
  total_discount: signedMinorAmount,
  total_discount_tax: signedMinorAmount,
  total_shipping: signedMinorAmount.nullable(),
  total_shipping_tax: signedMinorAmount.nullable(),
  total_price: signedMinorAmount,
  total_tax: signedMinorAmount,
  currency_code: z.string().length(3),
  currency_minor_unit: z.number().int().min(0),
});

export const shippingRateSchema = z.object({
  rate_id: z.string().min(1),
  name: z.string(),
  description: z.string().default(""),
  delivery_time: z.string().default(""),
  price: signedMinorAmount,
  taxes: signedMinorAmount,
  method_id: z.string(),
  instance_id: z.number().int().default(0),
  selected: z.boolean(),
  currency_code: z.string().length(3),
  currency_minor_unit: z.number().int().min(0),
});

export const shippingPackageSchema = z.object({
  package_id: z.number().int(),
  name: z.string(),
  shipping_rates: z.array(shippingRateSchema),
});

export const cartErrorSchema = z.object({
  code: z.string(),
  message: z.string(),
});

export const storeAddressSchema = z.object({
  first_name: z.string().default(""),
  last_name: z.string().default(""),
  company: z.string().default(""),
  address_1: z.string().default(""),
  address_2: z.string().default(""),
  city: z.string().default(""),
  state: z.string().default(""),
  postcode: z.string().default(""),
  country: z.string().default(""),
  email: z.string().default(""),
  phone: z.string().default(""),
});

export const cartSchema = z.object({
  coupons: z.array(cartCouponSchema),
  shipping_rates: z.array(shippingPackageSchema),
  shipping_address: storeAddressSchema.optional(),
  billing_address: storeAddressSchema.optional(),
  items: z.array(cartItemSchema),
  items_count: z.number().int().min(0),
  items_weight: z.number().default(0),
  needs_payment: z.boolean(),
  needs_shipping: z.boolean(),
  totals: cartTotalsSchema,
  payment_methods: z.array(z.string()).default([]),
  errors: z.array(cartErrorSchema).default([]),
});

export const paymentDetailSchema = z.object({
  key: z.string(),
  value: z.string(),
});

export const paymentResultSchema = z.object({
  payment_status: z.enum(["success", "failure", "pending", "error"]),
  payment_details: z.array(paymentDetailSchema).default([]),
  redirect_url: z.string().default(""),
});

export const checkoutResponseSchema = z.object({
  order_id: z.number().int().nonnegative(),
  status: z.string(),
  order_key: z.string().default(""),
  order_number: z.string().optional(),
  customer_note: z.string().default(""),
  billing_address: storeAddressSchema,
  shipping_address: storeAddressSchema,
  payment_method: z.string(),
  payment_result: paymentResultSchema.optional(),
  extensions: z.record(z.string(), z.unknown()).default({}),
});

export const wooApiErrorBodySchema = z.object({
  code: z.string().optional(),
  message: z.string().optional(),
  data: z
    .object({
      status: z.number().optional(),
    })
    .optional(),
});

export type StorePrice = z.infer<typeof priceSchema>;
export type StoreImage = z.infer<typeof imageSchema>;
export type StoreProduct = z.infer<typeof productSchema>;
export type StoreCategory = z.infer<typeof categorySchema>;
export type StoreAttribute = z.infer<typeof attributeSchema>;
export type StoreAttributeTerm = z.infer<typeof attributeTermSchema>;
export type StoreCartItem = z.infer<typeof cartItemSchema>;
export type StoreCartCoupon = z.infer<typeof cartCouponSchema>;
export type StoreShippingRate = z.infer<typeof shippingRateSchema>;
export type StoreShippingPackage = z.infer<typeof shippingPackageSchema>;
export type StoreCart = z.infer<typeof cartSchema>;
export type StoreAddress = z.infer<typeof storeAddressSchema>;
export type StoreCheckoutResponse = z.infer<typeof checkoutResponseSchema>;
