import type { SearchSortKey } from "@/shared/api/index.server";
import { routes } from "@/shared/config";

export type SearchPageSearchParams = Record<string, string | string[] | undefined>;

export type SearchQueryState = {
  q: string;
  category?: string;
  inStock: boolean;
  onSale: boolean;
  minPrice?: number;
  maxPrice?: number;
  sort: SearchSortKey;
  page: number;
};

const VALID_SORTS = new Set<SearchSortKey>([
  "relevance",
  "price_asc",
  "price_desc",
  "popularity",
  "name",
]);

const first = (value: string | string[] | undefined) => (Array.isArray(value) ? value[0] : value);

function parseNonNegInt(raw: string | undefined): number | undefined {
  if (!raw || !/^\d+$/.test(raw.trim())) return undefined;
  const parsed = Number.parseInt(raw.trim(), 10);
  return Number.isSafeInteger(parsed) && parsed >= 0 ? parsed : undefined;
}

export function parseSearchQuery(raw: SearchPageSearchParams): SearchQueryState {
  const q = (first(raw.q) ?? first(raw.kereses) ?? "").trim().slice(0, 120);
  const category = first(raw.kategoria)?.trim() || undefined;
  const inStock = first(raw.raktaron) === "1";
  const onSale = first(raw.akcios) === "1";
  let minPrice = parseNonNegInt(first(raw.min));
  let maxPrice = parseNonNegInt(first(raw.max));
  if (minPrice !== undefined && maxPrice !== undefined && minPrice > maxPrice) {
    [minPrice, maxPrice] = [maxPrice, minPrice];
  }
  const sortRaw = first(raw.rendezes) as SearchSortKey | undefined;
  const sort: SearchSortKey = sortRaw && VALID_SORTS.has(sortRaw) ? sortRaw : "relevance";
  const pageRaw = parseNonNegInt(first(raw.oldal));
  const page = pageRaw && pageRaw >= 1 ? pageRaw : 1;

  return {
    q,
    ...(category ? { category } : {}),
    inStock,
    onSale,
    ...(minPrice !== undefined ? { minPrice } : {}),
    ...(maxPrice !== undefined ? { maxPrice } : {}),
    sort,
    page,
  };
}

export function searchHref(state: Partial<SearchQueryState>): string {
  const params = new URLSearchParams();
  if (state.q?.trim()) params.set("q", state.q.trim());
  if (state.category) params.set("kategoria", state.category);
  if (state.inStock) params.set("raktaron", "1");
  if (state.onSale) params.set("akcios", "1");
  if (state.minPrice !== undefined) params.set("min", String(state.minPrice));
  if (state.maxPrice !== undefined) params.set("max", String(state.maxPrice));
  if (state.sort && state.sort !== "relevance") params.set("rendezes", state.sort);
  if (state.page && state.page > 1) params.set("oldal", String(state.page));
  const qs = params.toString();
  return qs ? `${routes.search}?${qs}` : routes.search;
}
