import type { ProductQuery } from "@kg/woo-client";

import type { CatalogFilterAttribute } from "@/entities/product";

export const PRODUCTS_PER_PAGE = 9;
const MAX_PRICE_BOUND = 1_000_000_000;
const SAFE_SLUG_RE = /^[a-z0-9_-]+$/i;
const FORBIDDEN_KEYS = new Set(["__proto__", "constructor", "prototype"]);

/** URL-paraméter -> Store API-rendezés. A rendezést a Woo végzi, a kliens nem rendez árat. */
export const sortOptions = {
  ajanlott: { orderby: "menu_order", order: "asc" },
  nepszeruseg: { orderby: "popularity", order: "desc" },
  "ar-novekvo": { orderby: "price", order: "asc" },
  "ar-csokkeno": { orderby: "price", order: "desc" },
  nevsor: { orderby: "title", order: "asc" },
  uj: { orderby: "date", order: "desc" },
} as const satisfies Record<string, Pick<ProductQuery, "orderby" | "order">>;

export type SortKey = keyof typeof sortOptions;

export type CatalogAttributeSelection = {
  attribute: string;
  slug: string;
};

export type CatalogSearchParams = Record<string, string | string[] | undefined>;

export type CatalogQueryState = {
  sort: SortKey;
  onSale: boolean;
  inStockOnly: boolean;
  minPrice?: number;
  maxPrice?: number;
  attributes: CatalogAttributeSelection[];
  page: number;
};

const first = (value: string | string[] | undefined) => (Array.isArray(value) ? value[0] : value);

function parseNonNegativeInt(raw: string | undefined): number | undefined {
  if (!raw || !/^\d+$/.test(raw.trim())) return undefined;
  const parsed = Number.parseInt(raw.trim(), 10);
  if (!Number.isSafeInteger(parsed) || parsed < 0 || parsed > MAX_PRICE_BOUND) return undefined;
  return parsed;
}

function parsePositiveInt(raw: string | undefined): number | undefined {
  const parsed = parseNonNegativeInt(raw);
  return parsed !== undefined && parsed >= 1 ? parsed : undefined;
}

export function parseCatalogQuery(
  searchParams: CatalogSearchParams,
  availableAttributes?: CatalogFilterAttribute[],
): CatalogQueryState {
  const sortParam = first(searchParams.rendezes);
  const sort: SortKey =
    sortParam && Object.hasOwn(sortOptions, sortParam) ? (sortParam as SortKey) : "ajanlott";
  const onSale = first(searchParams.akcios) === "1";
  const inStockOnly = first(searchParams.raktaron) === "1";

  let minPrice = parseNonNegativeInt(first(searchParams.min));
  let maxPrice = parseNonNegativeInt(first(searchParams.max));
  if (minPrice !== undefined && maxPrice !== undefined && minPrice > maxPrice) {
    [minPrice, maxPrice] = [maxPrice, minPrice];
  }

  const page = parsePositiveInt(first(searchParams.oldal)) ?? 1;

  const attrMap = new Map<string, string>();
  for (const [key, rawValue] of Object.entries(searchParams)) {
    if (!key.startsWith("attr_")) continue;
    const taxonomy = key.slice(5);
    if (!taxonomy || FORBIDDEN_KEYS.has(taxonomy) || !SAFE_SLUG_RE.test(taxonomy)) continue;

    const slug = first(rawValue)?.trim();
    if (!slug || !SAFE_SLUG_RE.test(slug)) continue;

    if (availableAttributes) {
      const knownAttr = availableAttributes.find((attr) => attr.taxonomy === taxonomy);
      if (!knownAttr || !knownAttr.terms.some((term) => term.slug === slug)) continue;
    }

    attrMap.set(taxonomy, slug);
  }

  const attributes: CatalogAttributeSelection[] = [...attrMap.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([attribute, slug]) => ({ attribute, slug }));

  return {
    sort,
    onSale,
    inStockOnly,
    ...(minPrice !== undefined ? { minPrice } : {}),
    ...(maxPrice !== undefined ? { maxPrice } : {}),
    attributes,
    page,
  };
}

/** Link egy szűrő, rendezés vagy oldalszám állapotára (a többi paraméter megmarad). */
export function catalogHref(
  basePath: string,
  state: {
    sort: SortKey;
    onSale: boolean;
    inStockOnly?: boolean;
    minPrice?: number;
    maxPrice?: number;
    attributes?: CatalogAttributeSelection[];
    page?: number;
  },
): string {
  const params = new URLSearchParams();
  if (state.sort !== "ajanlott") params.set("rendezes", state.sort);
  if (state.onSale) params.set("akcios", "1");
  if (state.inStockOnly) params.set("raktaron", "1");
  if (state.minPrice !== undefined) params.set("min", String(state.minPrice));
  if (state.maxPrice !== undefined) params.set("max", String(state.maxPrice));
  if (state.attributes?.length) {
    const sorted = [...state.attributes].sort((a, b) => a.attribute.localeCompare(b.attribute));
    for (const item of sorted) {
      params.set(`attr_${item.attribute}`, item.slug);
    }
  }
  if (state.page !== undefined && state.page > 1) params.set("oldal", String(state.page));
  const query = params.toString();
  return query ? `${basePath}?${query}` : basePath;
}

export function toggleAttributeFilter(
  current: CatalogAttributeSelection[],
  taxonomy: string,
  slug: string,
): CatalogAttributeSelection[] {
  const isSameActive = current.some((item) => item.attribute === taxonomy && item.slug === slug);
  const rest = current.filter((item) => item.attribute !== taxonomy);
  return isSameActive ? rest : [...rest, { attribute: taxonomy, slug }];
}

export function countActiveFilters(state: CatalogQueryState): number {
  let count = 0;
  if (state.onSale) count += 1;
  if (state.inStockOnly) count += 1;
  if (state.minPrice !== undefined || state.maxPrice !== undefined) count += 1;
  count += state.attributes.length;
  return count;
}

export function toProductQuery(
  state: CatalogQueryState,
  categoryId?: number,
  minorUnit = 0,
): ProductQuery {
  const scale = 10 ** Math.max(0, minorUnit);
  return {
    category: categoryId ? String(categoryId) : undefined,
    onSale: state.onSale || undefined,
    stockStatus: state.inStockOnly ? "instock" : undefined,
    minPrice: state.minPrice !== undefined ? state.minPrice * scale : undefined,
    maxPrice: state.maxPrice !== undefined ? state.maxPrice * scale : undefined,
    attributes: state.attributes.length > 0 ? state.attributes : undefined,
    page: state.page,
    perPage: PRODUCTS_PER_PAGE,
    ...sortOptions[state.sort],
  };
}
