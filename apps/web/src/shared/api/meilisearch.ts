import "server-only";

import type { Brand } from "@kg/brand-config";
import type { StoreProduct } from "@kg/woo-client";
import { createFixtureStoreClient } from "@kg/woo-client/fixtures";
import { z } from "zod";

import { serverEnv } from "@/shared/config/index.server";
import { AppError } from "@/shared/lib/errors";
import { getCurrencyMinorUnit } from "@/shared/lib/format";
import { decodeEntities } from "@/shared/lib/html";

export type SearchSortKey = "relevance" | "price_asc" | "price_desc" | "popularity" | "name";

export type SearchProductsQuery = {
  q: string;
  category?: string;
  inStock?: boolean;
  onSale?: boolean;
  minPrice?: number;
  maxPrice?: number;
  sort?: SearchSortKey;
  page?: number;
  perPage?: number;
};

export const searchHitSchema = z.object({
  id: z.number().int().positive(),
  brandId: z.string().min(1),
  name: z.string().min(1),
  slug: z.string().min(1),
  sku: z.string().default(""),
  shortDescription: z.string().default(""),
  priceMinor: z.number().int().nonnegative(),
  regularPriceMinor: z.number().int().nonnegative(),
  currency: z.string().length(3),
  minorUnit: z.number().int().min(0).max(4),
  onSale: z.boolean(),
  inStock: z.boolean(),
  stockStatus: z.enum(["in_stock", "out_of_stock", "backorder"]),
  categories: z.array(z.string()),
  categorySlugs: z.array(z.string()),
  imageUrl: z.string().nullable(),
  imageAlt: z.string().default(""),
  popularity: z.number().int().nonnegative().default(0),
  _formatted: z
    .object({
      name: z.string().optional(),
    })
    .optional(),
});

export type SearchHit = {
  id: number;
  name: string;
  highlightedName: string;
  slug: string;
  sku: string;
  priceMinor: number;
  regularPriceMinor: number;
  currency: string;
  minorUnit: number;
  onSale: boolean;
  inStock: boolean;
  stockStatus: "in_stock" | "out_of_stock" | "backorder";
  categories: string[];
  categorySlugs: string[];
  imageUrl: string | null;
  imageAlt: string;
};

export type SearchFacetCounts = {
  categorySlugs: Record<string, number>;
  inStockCount: number;
  onSaleCount: number;
};

export type SearchProductsResult = {
  hits: SearchHit[];
  totalHits: number;
  page: number;
  totalPages: number;
  perPage: number;
  facets: SearchFacetCounts;
};

const meiliSearchResponseSchema = z.object({
  hits: z.array(searchHitSchema),
  totalHits: z.number().int().nonnegative().optional(),
  estimatedTotalHits: z.number().int().nonnegative().optional(),
  page: z.number().int().positive().optional(),
  totalPages: z.number().int().nonnegative().optional(),
  hitsPerPage: z.number().int().positive().optional(),
  facetDistribution: z
    .object({
      categorySlugs: z.record(z.string(), z.number().int().nonnegative()).optional(),
      inStock: z.record(z.string(), z.number().int().nonnegative()).optional(),
      onSale: z.record(z.string(), z.number().int().nonnegative()).optional(),
    })
    .optional(),
});

export type BrandSearchConfig = {
  host: string;
  searchKey: string;
  indexUid: string;
};

/**
 * Brandenkénti Meilisearch BFF konfiguráció (`MEILISEARCH_URL` + `MEILISEARCH_<BRAND>_SEARCH_KEY`).
 * Az admin/master kulcsot az `apps/web` soha nem olvassa és nem fogadja el (ADR-0012).
 */
export function getBrandSearchConfig(
  brand: Brand,
  raw: Record<string, string | undefined> = process.env,
): BrandSearchConfig | null {
  const rawHost = raw.MEILISEARCH_URL?.trim();
  const keyEnvName = `MEILISEARCH_${brand.id.toUpperCase().replace(/-/g, "_")}_SEARCH_KEY`;
  const searchKey = raw[keyEnvName]?.trim();

  if (!rawHost || !searchKey) {
    return null;
  }

  const hostParsed = z.string().url().safeParse(rawHost);
  if (!hostParsed.success) {
    throw new AppError("SEARCH.CONFIG_MISSING", {
      internalReason: "Érvénytelen URL a MEILISEARCH_URL környezeti változóban.",
    });
  }

  return {
    host: hostParsed.data.replace(/\/+$/, ""),
    searchKey,
    indexUid: brand.search.index,
  };
}

function normalizeForMatch(text: string): string {
  return text
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}

function buildHighlightedName(name: string, query: string): string {
  const trimmed = query.trim();
  if (!trimmed) return name;
  const escaped = trimmed.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  try {
    return name.replace(new RegExp(`(${escaped})`, "gi"), "<mark>$1</mark>");
  } catch {
    return name;
  }
}

function parseMinor(raw: string): number {
  const digits = raw.trim();
  if (!/^\d+$/.test(digits)) return 0;
  const parsed = Number.parseInt(digits, 10);
  return Number.isSafeInteger(parsed) && parsed >= 0 ? parsed : 0;
}

function fixtureProductToHit(product: StoreProduct, query: string): SearchHit {
  const priceMinor = parseMinor(product.prices.price);
  const regularPriceMinor = Math.max(priceMinor, parseMinor(product.prices.regular_price));
  const name = decodeEntities(product.name);
  const img = product.images[0];
  return {
    id: product.id,
    name,
    highlightedName: buildHighlightedName(name, query),
    slug: product.slug,
    sku: product.sku,
    priceMinor,
    regularPriceMinor,
    currency: product.prices.currency_code,
    minorUnit: product.prices.currency_minor_unit,
    onSale: product.on_sale && regularPriceMinor > priceMinor,
    inStock: product.is_in_stock,
    stockStatus: product.is_in_stock
      ? "in_stock"
      : product.is_on_backorder
        ? "backorder"
        : "out_of_stock",
    categories: product.categories.map((c) => decodeEntities(c.name)),
    categorySlugs: product.categories.map((c) => c.slug),
    imageUrl: img?.thumbnail || img?.src || null,
    imageAlt: img?.alt ? decodeEntities(img.alt) : name,
  };
}

async function searchWithFixtures(
  brand: Brand,
  query: SearchProductsQuery,
): Promise<SearchProductsResult> {
  const page = Math.max(1, query.page ?? 1);
  const perPage = Math.min(24, Math.max(1, query.perPage ?? 9));
  const { products } = await createFixtureStoreClient().getProductsPage({ perPage: 100 });
  const tokens = normalizeForMatch(query.q).split(/\s+/).filter(Boolean);

  const matchedByText = products.filter((product) => {
    if (tokens.length === 0) return true;
    const haystack = normalizeForMatch(
      [
        decodeEntities(product.name),
        product.sku,
        ...product.categories.map((c) => decodeEntities(c.name)),
        product.short_description,
      ].join(" "),
    );
    return tokens.every((token) => haystack.includes(token));
  });

  // Facet számok a szöveges találatokból (szűrők előtt), hogy a felhasználó lássa az elérhető kategóriákat.
  const categorySlugs: Record<string, number> = {};
  let inStockCount = 0;
  let onSaleCount = 0;
  for (const product of matchedByText) {
    if (product.is_in_stock) inStockCount += 1;
    if (product.on_sale) onSaleCount += 1;
    for (const cat of product.categories) {
      categorySlugs[cat.slug] = (categorySlugs[cat.slug] ?? 0) + 1;
    }
  }

  const filtered = matchedByText.filter((product) => {
    if (query.category && !product.categories.some((c) => c.slug === query.category)) return false;
    if (query.inStock && !product.is_in_stock) return false;
    if (query.onSale && !product.on_sale) return false;
    const price = parseMinor(product.prices.price);
    const scale = 10 ** Math.max(0, product.prices.currency_minor_unit);
    if (query.minPrice !== undefined && price < query.minPrice * scale) return false;
    if (query.maxPrice !== undefined && price > query.maxPrice * scale) return false;
    return true;
  });

  const sorted = [...filtered].sort((a, b) => {
    switch (query.sort) {
      case "price_asc":
        return parseMinor(a.prices.price) - parseMinor(b.prices.price);
      case "price_desc":
        return parseMinor(b.prices.price) - parseMinor(a.prices.price);
      case "popularity":
        return (b.review_count ?? 0) - (a.review_count ?? 0);
      case "name":
        return decodeEntities(a.name).localeCompare(decodeEntities(b.name), brand.locale);
      default:
        return 0;
    }
  });

  const totalHits = sorted.length;
  const totalPages = totalHits === 0 ? 0 : Math.ceil(totalHits / perPage);
  const start = (page - 1) * perPage;
  const hits = sorted.slice(start, start + perPage).map((p) => fixtureProductToHit(p, query.q));

  return {
    hits,
    totalHits,
    page,
    totalPages,
    perPage,
    facets: { categorySlugs, inStockCount, onSaleCount },
  };
}

function escapeMeiliFilterValue(value: string): string {
  return value.replace(/\\/g, "\\\\").replace(/"/g, '\\"');
}

function buildMeiliSort(sort?: SearchSortKey): string[] | undefined {
  switch (sort) {
    case "price_asc":
      return ["priceMinor:asc"];
    case "price_desc":
      return ["priceMinor:desc"];
    case "popularity":
      return ["popularity:desc"];
    case "name":
      return ["name:asc"];
    default:
      return undefined;
  }
}

export type SearchProductsOptions = {
  env?: Record<string, string | undefined>;
  fetchImpl?: typeof fetch;
  timeoutMs?: number;
};

/**
 * Szerveroldali BFF termékkeresés brandenként (`products_<brand>`, ADR-0012).
 * - Élő módban a brand search-only kulcsával hívja a Meilisearch szervert (és `brandId` szűrőt is ad).
 * - `KG_STORE_FIXTURES=1` mellett (ha nincs `MEILISEARCH_URL` megadva) determinisztikus fixture-keresést futtat.
 */
export async function searchProducts(
  brand: Brand,
  query: SearchProductsQuery,
  options: SearchProductsOptions = {},
): Promise<SearchProductsResult> {
  const env = options.env ?? process.env;
  const config = getBrandSearchConfig(brand, env);

  if (!config) {
    const useFixtures = (env.KG_STORE_FIXTURES ?? serverEnv.KG_STORE_FIXTURES) === "1";
    if (useFixtures) {
      return searchWithFixtures(brand, query);
    }
    throw new AppError("SEARCH.CONFIG_MISSING", {
      internalReason: `Hiányzó Meilisearch konfiguráció a(z) ${brand.id} brandhez.`,
    });
  }

  const page = Math.max(1, query.page ?? 1);
  const perPage = Math.min(24, Math.max(1, query.perPage ?? 9));
  const filter: string[] = [`brandId = "${escapeMeiliFilterValue(brand.id)}"`];
  if (query.category) {
    filter.push(`categorySlugs = "${escapeMeiliFilterValue(query.category)}"`);
  }
  if (query.inStock) {
    filter.push("inStock = true");
  }
  if (query.onSale) {
    filter.push("onSale = true");
  }
  const priceScale = 10 ** Math.max(0, getCurrencyMinorUnit(brand.currency));
  if (query.minPrice !== undefined) {
    filter.push(`priceMinor >= ${Math.max(0, Math.trunc(query.minPrice)) * priceScale}`);
  }
  if (query.maxPrice !== undefined) {
    filter.push(`priceMinor <= ${Math.max(0, Math.trunc(query.maxPrice)) * priceScale}`);
  }

  const sort = buildMeiliSort(query.sort);
  const fetchImpl = options.fetchImpl ?? fetch;
  const timeoutMs = options.timeoutMs ?? 6_000;

  let response: Response;
  try {
    response = await fetchImpl(
      `${config.host}/indexes/${encodeURIComponent(config.indexUid)}/search`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${config.searchKey}`,
          Accept: "application/json",
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          q: query.q.trim().slice(0, 120),
          page,
          hitsPerPage: perPage,
          filter,
          facets: ["categorySlugs", "inStock", "onSale"],
          attributesToHighlight: ["name"],
          highlightPreTag: "<mark>",
          highlightPostTag: "</mark>",
          ...(sort ? { sort } : {}),
        }),
        cache: "no-store",
        signal: AbortSignal.timeout(timeoutMs),
      },
    );
  } catch (error) {
    throw new AppError("SEARCH.UNAVAILABLE", {
      cause: error,
      internalReason: `Meilisearch hálózati hiba (${brand.id})`,
    });
  }

  if (!response.ok) {
    throw new AppError(response.status >= 500 ? "SEARCH.UNAVAILABLE" : "SEARCH.INVALID_RESPONSE", {
      internalReason: `Meilisearch HTTP ${response.status} (${brand.id})`,
    });
  }

  let json: unknown;
  try {
    json = await response.json();
  } catch (error) {
    throw new AppError("SEARCH.INVALID_RESPONSE", {
      cause: error,
      internalReason: `Meilisearch nem JSON válasz (${brand.id})`,
    });
  }

  const parsed = meiliSearchResponseSchema.safeParse(json);
  if (!parsed.success) {
    throw new AppError("SEARCH.INVALID_RESPONSE", {
      cause: parsed.error,
      internalReason: `Meilisearch válaszséma-eltérés (${brand.id})`,
    });
  }

  const data = parsed.data;
  const totalHits = data.totalHits ?? data.estimatedTotalHits ?? data.hits.length;
  const totalPages = data.totalPages ?? (totalHits === 0 ? 0 : Math.ceil(totalHits / perPage));

  return {
    hits: data.hits.map((hit) => ({
      id: hit.id,
      name: hit.name,
      highlightedName: hit._formatted?.name ?? hit.name,
      slug: hit.slug,
      sku: hit.sku,
      priceMinor: hit.priceMinor,
      regularPriceMinor: hit.regularPriceMinor,
      currency: hit.currency,
      minorUnit: hit.minorUnit,
      onSale: hit.onSale,
      inStock: hit.inStock,
      stockStatus: hit.stockStatus,
      categories: hit.categories,
      categorySlugs: hit.categorySlugs,
      imageUrl: hit.imageUrl,
      imageAlt: hit.imageAlt || hit.name,
    })),
    totalHits,
    page: data.page ?? page,
    totalPages,
    perPage: data.hitsPerPage ?? perPage,
    facets: {
      categorySlugs: data.facetDistribution?.categorySlugs ?? {},
      inStockCount: data.facetDistribution?.inStock?.true ?? 0,
      onSaleCount: data.facetDistribution?.onSale?.true ?? 0,
    },
  };
}
