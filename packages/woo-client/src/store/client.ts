import type { z } from "zod";

import { WooError } from "../errors";
import {
  categoryListSchema,
  productListSchema,
  type StoreCategory,
  type StoreProduct,
} from "./schemas";

/** A Next `fetch` cache-opciói (revalidate, tagek); a kliens nem függ a Next-től. */
export type FetchCacheOptions = { revalidate?: number | false; tags?: string[] };

export type StoreClientOptions = {
  baseUrl: string;
  /** Tesztben vagy speciális futtatókörnyezetben cserélhető. */
  fetch?: typeof fetch;
  timeoutMs?: number;
};

export type ProductQuery = {
  category?: string;
  perPage?: number;
  orderby?: "date" | "price" | "popularity" | "title" | "menu_order";
  order?: "asc" | "desc";
  onSale?: boolean;
};

export type StoreClient = {
  getProducts(query?: ProductQuery, cache?: FetchCacheOptions): Promise<StoreProduct[]>;
  getProductBySlug(slug: string, cache?: FetchCacheOptions): Promise<StoreProduct | null>;
  getCategories(cache?: FetchCacheOptions): Promise<StoreCategory[]>;
};

export function createStoreClient({
  baseUrl,
  fetch: fetchImpl = fetch,
  timeoutMs = 8000,
}: StoreClientOptions): StoreClient {
  const root = `${baseUrl.replace(/\/+$/, "")}/wp-json/wc/store/v1`;

  async function request<T extends z.ZodType>(
    path: string,
    params: Record<string, string | number | boolean | undefined>,
    schema: T,
    cache?: FetchCacheOptions,
  ): Promise<z.infer<T>> {
    const url = new URL(`${root}${path}`);
    for (const [key, value] of Object.entries(params)) {
      if (value !== undefined) url.searchParams.set(key, String(value));
    }

    let response: Response;
    try {
      response = await fetchImpl(url, {
        headers: { Accept: "application/json" },
        signal: AbortSignal.timeout(timeoutMs),
        // A Next fetch-kiterjesztése; más környezet figyelmen kívül hagyja.
        ...(cache ? { next: cache } : {}),
      } as RequestInit);
    } catch (cause) {
      throw new WooError("WOO.UNAVAILABLE", `Store API nem elérhető: ${path}`, { cause });
    }

    if (!response.ok) {
      throw new WooError("WOO.UNAVAILABLE", `Store API hiba (${response.status}): ${path}`, {
        status: response.status,
      });
    }

    const parsed = schema.safeParse(await response.json().catch(() => undefined));
    if (!parsed.success) {
      throw new WooError("WOO.CONTRACT_MISMATCH", `Váratlan Store API-válasz: ${path}`, {
        cause: parsed.error,
      });
    }
    return parsed.data;
  }

  return {
    getProducts(query = {}, cache) {
      return request(
        "/products",
        {
          category: query.category,
          per_page: query.perPage ?? 24,
          orderby: query.orderby,
          order: query.order,
          on_sale: query.onSale,
        },
        productListSchema,
        cache,
      );
    },
    async getProductBySlug(slug, cache) {
      const products = await request("/products", { slug }, productListSchema, cache);
      return products[0] ?? null;
    },
    getCategories(cache) {
      return request("/products/categories", { per_page: 100 }, categoryListSchema, cache);
    },
  };
}
