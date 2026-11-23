import type { Brand } from "@kg/brand-config";
import type { StoreProduct } from "@kg/woo-client";
import { z } from "zod";

export const searchProductDocumentSchema = z.object({
  id: z.number().int().positive(),
  brandId: z.string().min(1),
  name: z.string().min(1),
  slug: z.string().min(1),
  sku: z.string(),
  shortDescription: z.string(),
  priceMinor: z.number().int().nonnegative(),
  regularPriceMinor: z.number().int().nonnegative(),
  currency: z.string().length(3),
  minorUnit: z.number().int().min(0).max(4),
  onSale: z.boolean(),
  inStock: z.boolean(),
  stockStatus: z.enum(["in_stock", "out_of_stock", "backorder"]),
  categories: z.array(z.string()),
  categorySlugs: z.array(z.string()),
  attributes: z.record(z.string(), z.array(z.string())),
  attributeFacets: z.array(z.string()),
  imageUrl: z.string().nullable(),
  imageAlt: z.string(),
  popularity: z.number().int().nonnegative(),
});

export type SearchProductDocument = z.infer<typeof searchProductDocumentSchema>;

export type MeilisearchIndexSettings = {
  searchableAttributes: string[];
  filterableAttributes: string[];
  sortableAttributes: string[];
  synonyms: Record<string, string[]>;
  stopWords: string[];
  typoTolerance: {
    enabled: boolean;
    minWordSizeForTypos: {
      oneTypo: number;
      twoTypos: number;
    };
    disableOnAttributes: string[];
  };
};

const HUNGARIAN_SYNONYMS: Record<string, string[]> = {
  billentyuzet: ["billentyűzet", "klaviatúra", "klaviatura", "keyboard"],
  billentyűzet: ["billentyuzet", "klaviatúra", "klaviatura", "keyboard"],
  eger: ["egér", "mouse"],
  egér: ["eger", "mouse"],
  fejhallgato: ["fejhallgató", "headset", "füles", "fules"],
  fejhallgató: ["fejhallgato", "headset", "füles", "fules"],
  headset: ["fejhallgató", "fejhallgato", "füles"],
  egerpad: ["egérpad", "mousepad"],
  egérpad: ["egerpad", "mousepad"],
  kontroller: ["gamepad", "irányító", "iranyito"],
  mikrofon: ["mic"],
  webkamera: ["webcam", "kamera"],
  lampa: ["lámpa", "világítás", "vilagitas", "led"],
  lámpa: ["lampa", "világítás", "vilagitas", "led"],
  kocka: ["dobókocka", "dobokocka", "dice"],
  kartya: ["kártya", "tcg"],
  kártya: ["kartya", "tcg"],
  figura: ["szobor", "gyűjtői", "gyujtoi"],
  akcio: ["akció", "akciós", "akcios", "leárazás", "learazas"],
};

const HUNGARIAN_STOP_WORDS: string[] = [
  "a",
  "az",
  "és",
  "vagy",
  "egy",
  "de",
  "hogy",
  "is",
  "nem",
  "van",
  "volt",
  "meg",
  "még",
  "csak",
  "mint",
  "már",
  "ez",
  "azt",
  "ezt",
  "ami",
  "aki",
  "ahol",
  "mert",
  "ha",
  "sem",
  "se",
];

/**
 * Brandenkénti `products_<brand>` index rögzített Meilisearch beállításai.
 * Kódból, idempotensen alkalmazható az `adapters/meilisearch` klienssel.
 */
export function buildBrandIndexSettings(): MeilisearchIndexSettings {
  return {
    searchableAttributes: ["name", "sku", "categories", "shortDescription", "attributeFacets"],
    filterableAttributes: [
      "brandId",
      "categorySlugs",
      "inStock",
      "onSale",
      "priceMinor",
      "attributeFacets",
    ],
    sortableAttributes: ["priceMinor", "popularity", "name"],
    synonyms: HUNGARIAN_SYNONYMS,
    stopWords: HUNGARIAN_STOP_WORDS,
    typoTolerance: {
      enabled: true,
      minWordSizeForTypos: {
        oneTypo: 4,
        twoTypos: 8,
      },
      disableOnAttributes: ["sku"],
    },
  };
}

function stripHtmlAndEntities(html: string): string {
  return html
    .replace(/<[^>]*>/g, " ")
    .replace(/&#x([0-9a-f]+);/gi, (_, hex: string) => {
      const code = Number.parseInt(hex, 16);
      return Number.isFinite(code) && code > 0 && code <= 0x10ffff
        ? String.fromCodePoint(code)
        : "";
    })
    .replace(/&#(\d+);/g, (_, dec: string) => {
      const code = Number.parseInt(dec, 10);
      return Number.isFinite(code) && code > 0 && code <= 0x10ffff
        ? String.fromCodePoint(code)
        : "";
    })
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&quot;/gi, '"')
    .replace(/&apos;/gi, "'")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&ndash;/gi, "–")
    .replace(/&mdash;/gi, "—")
    .replace(/&bdquo;/gi, "„")
    .replace(/&ldquo;/gi, "“")
    .replace(/&rdquo;/gi, "”")
    .replace(/&hellip;/gi, "…")
    .replace(/\s+/g, " ")
    .trim();
}

function parseMinorAmount(raw: string): number {
  const digits = raw.trim();
  if (!/^\d+$/.test(digits)) return 0;
  const parsed = Number.parseInt(digits, 10);
  return Number.isSafeInteger(parsed) && parsed >= 0 ? parsed : 0;
}

function mapStockStatus(product: StoreProduct): "in_stock" | "out_of_stock" | "backorder" {
  if (product.is_in_stock) return "in_stock";
  if (product.is_on_backorder) return "backorder";
  return "out_of_stock";
}

/**
 * WooCommerce Store API termék → Meilisearch dokumentum (Zod-dal validálva).
 * Az ár kizárólag egész minor unitban tárolódik (float kerekítés nélkül).
 */
export function mapStoreProductToSearchDocument(
  product: StoreProduct,
  brand: Brand,
): SearchProductDocument {
  const priceMinor = parseMinorAmount(product.prices.price);
  const regularPriceMinor = Math.max(priceMinor, parseMinorAmount(product.prices.regular_price));
  const attributes: Record<string, string[]> = {};
  const attributeFacets: string[] = [];

  for (const attr of product.attributes) {
    const key = (attr.taxonomy || attr.name).trim();
    if (!key) continue;
    const values = attr.terms.map((t) => stripHtmlAndEntities(t.name)).filter(Boolean);
    if (values.length > 0) {
      attributes[key] = values;
      for (const value of values) {
        attributeFacets.push(`${key}:${value}`);
      }
    }
  }

  const primaryImage = product.images[0];
  const rawDoc = {
    id: product.id,
    brandId: brand.id,
    name: stripHtmlAndEntities(product.name),
    slug: product.slug,
    sku: product.sku.trim(),
    shortDescription: stripHtmlAndEntities(product.short_description || product.description).slice(
      0,
      400,
    ),
    priceMinor,
    regularPriceMinor,
    currency: (product.prices.currency_code || brand.currency).toUpperCase().slice(0, 3),
    minorUnit: product.prices.currency_minor_unit,
    onSale: product.on_sale && regularPriceMinor > priceMinor,
    inStock: product.is_in_stock,
    stockStatus: mapStockStatus(product),
    categories: product.categories.map((c) => stripHtmlAndEntities(c.name)).filter(Boolean),
    categorySlugs: product.categories.map((c) => c.slug).filter(Boolean),
    attributes,
    attributeFacets,
    imageUrl: primaryImage?.thumbnail || primaryImage?.src || null,
    imageAlt: primaryImage?.alt
      ? stripHtmlAndEntities(primaryImage.alt)
      : stripHtmlAndEntities(product.name),
    popularity: Math.max(0, Math.trunc(product.review_count ?? 0)),
  };

  return searchProductDocumentSchema.parse(rawDoc);
}
