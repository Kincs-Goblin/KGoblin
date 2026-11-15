import type { Brand } from "@kg/brand-config";
import type { z } from "zod";

import { resolveBrandBaseUrl } from "../brand-url";
import { mapWooErrorCode, WooError, type WooErrorContext } from "../errors";
import {
  attributeListSchema,
  attributeTermListSchema,
  cartSchema,
  categoryListSchema,
  checkoutResponseSchema,
  productListSchema,
  productSchema,
  wooApiErrorBodySchema,
  type StoreAttribute,
  type StoreAttributeTerm,
  type StoreCart,
  type StoreCategory,
  type StoreCheckoutResponse,
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

export type WooClientOptions = {
  env?: Record<string, string | undefined>;
  fetch?: typeof fetch;
  timeoutMs?: number;
};

export type ProductQuery = {
  category?: string;
  page?: number;
  perPage?: number;
  search?: string;
  minPrice?: number;
  maxPrice?: number;
  stockStatus?: "instock" | "outofstock" | "onbackorder";
  orderby?: "date" | "price" | "popularity" | "title" | "menu_order";
  order?: "asc" | "desc";
  onSale?: boolean;
};

export type CartSession = {
  cartToken?: string;
  nonce?: string;
};

export type StoreCartResult = {
  cart: StoreCart;
  cartToken: string | undefined;
  nonce: string | undefined;
};

export type StoreCheckoutResult = {
  checkout: StoreCheckoutResponse;
  cartToken: string | undefined;
  nonce: string | undefined;
};

export type AddCartItemInput = {
  id: number;
  quantity: number;
  variation?: Array<{ attribute: string; value: string }>;
};

export type UpdateCartItemInput = {
  key: string;
  quantity: number;
};

export type RemoveCartItemInput = {
  key: string;
};

export type CouponInput = {
  code: string;
};

export type SelectShippingRateInput = {
  packageId?: number;
  rateId: string;
};

export type CheckoutAddressInput = {
  first_name: string;
  last_name: string;
  company?: string;
  address_1: string;
  address_2?: string;
  city: string;
  state?: string;
  postcode: string;
  country: string;
  email?: string;
  phone?: string;
};

export type SubmitCheckoutInput = {
  billing_address: CheckoutAddressInput;
  shipping_address: CheckoutAddressInput;
  payment_method: string;
  payment_data?: Array<{ key: string; value: unknown }>;
  customer_note?: string;
  extensions?: {
    kg_headless?: {
      is_company?: boolean;
      company_name?: string;
      tax_number?: string;
      accept_terms: boolean;
      accept_payment_obligation: boolean;
    };
  };
};

export type StoreClient = {
  getProducts(query?: ProductQuery, cache?: FetchCacheOptions): Promise<StoreProduct[]>;
  getProductById(id: number, cache?: FetchCacheOptions): Promise<StoreProduct | null>;
  getProductBySlug(slug: string, cache?: FetchCacheOptions): Promise<StoreProduct | null>;
  getCategories(cache?: FetchCacheOptions): Promise<StoreCategory[]>;
  getAttributes(cache?: FetchCacheOptions): Promise<StoreAttribute[]>;
  getAttributeTerms(attributeId: number, cache?: FetchCacheOptions): Promise<StoreAttributeTerm[]>;
  getCart(session?: CartSession): Promise<StoreCartResult>;
  addCartItem(input: AddCartItemInput, session?: CartSession): Promise<StoreCartResult>;
  updateCartItem(input: UpdateCartItemInput, session?: CartSession): Promise<StoreCartResult>;
  removeCartItem(input: RemoveCartItemInput, session?: CartSession): Promise<StoreCartResult>;
  applyCoupon(input: CouponInput, session?: CartSession): Promise<StoreCartResult>;
  removeCoupon(input: CouponInput, session?: CartSession): Promise<StoreCartResult>;
  selectShippingRate(
    input: SelectShippingRateInput,
    session?: CartSession,
  ): Promise<StoreCartResult>;
  getCheckout(session: CartSession): Promise<StoreCheckoutResult>;
  submitCheckout(input: SubmitCheckoutInput, session: CartSession): Promise<StoreCheckoutResult>;
};

export type WooStoreClient = StoreClient & {
  readonly brandId: string;
};

function readSessionHeaders(response: Response, fallback?: CartSession): CartSession {
  return {
    cartToken: response.headers.get("Cart-Token") ?? fallback?.cartToken,
    nonce: response.headers.get("Nonce") ?? fallback?.nonce,
  };
}

export function createStoreClient({
  baseUrl,
  fetch: fetchImpl = fetch,
  timeoutMs = 8000,
}: StoreClientOptions): StoreClient {
  const normalizedBase = baseUrl.replace(/\/+$/, "");
  try {
    new URL(normalizedBase);
  } catch (cause) {
    throw new WooError("WOO.UNAVAILABLE", "Érvénytelen Store API alap URL.", { cause });
  }
  const root = `${normalizedBase}/wp-json/wc/store/v1`;

  async function rawRequest<T extends z.ZodType>(options: {
    method: "GET" | "POST";
    path: string;
    params?: Record<string, string | number | boolean | undefined>;
    body?: unknown;
    session?: CartSession;
    schema: T;
    cache?: FetchCacheOptions;
    noStore?: boolean;
    errorContext?: WooErrorContext;
    allowNotFound?: boolean;
  }): Promise<{ data: z.infer<T>; response: Response } | null> {
    const url = new URL(`${root}${options.path}`);
    if (options.params) {
      for (const [key, value] of Object.entries(options.params)) {
        if (value !== undefined) url.searchParams.set(key, String(value));
      }
    }

    const headers: Record<string, string> = { Accept: "application/json" };
    if (options.session?.cartToken) headers["Cart-Token"] = options.session.cartToken;
    if (options.session?.nonce) headers["Nonce"] = options.session.nonce;
    if (options.body !== undefined) headers["Content-Type"] = "application/json";

    const init: RequestInit & { next?: FetchCacheOptions } = {
      method: options.method,
      headers,
      signal: AbortSignal.timeout(timeoutMs),
      ...(options.body !== undefined ? { body: JSON.stringify(options.body) } : {}),
      ...(options.noStore
        ? { cache: "no-store" }
        : options.cache
          ? { next: options.cache }
          : options.method === "POST" || options.session
            ? { cache: "no-store" }
            : {}),
    };

    let response: Response;
    try {
      response = await fetchImpl(url, init);
    } catch (cause) {
      throw new WooError("WOO.UNAVAILABLE", `Store API nem elérhető: ${options.path}`, { cause });
    }

    if (options.allowNotFound && response.status === 404) {
      return null;
    }

    if (!response.ok) {
      if (response.status >= 500) {
        throw new WooError(
          "WOO.UNAVAILABLE",
          `Store API hiba (${response.status}): ${options.path}`,
          { status: response.status },
        );
      }

      const rawError = await response.json().catch(() => undefined);
      const parsedError = wooApiErrorBodySchema.safeParse(rawError);
      const wooCode = parsedError.success ? parsedError.data.code : undefined;
      const mappedCode = mapWooErrorCode(
        wooCode,
        response.status,
        options.errorContext ?? "catalog",
      );
      const wooMessage = parsedError.success ? parsedError.data.message : undefined;

      throw new WooError(
        mappedCode,
        wooMessage || `Store API kérés elutasítva (${response.status}): ${options.path}`,
        {
          status: response.status,
          ...(wooCode ? { wooCode } : {}),
        },
      );
    }

    let json: unknown;
    try {
      json = await response.json();
    } catch (cause) {
      throw new WooError("WOO.INVALID_RESPONSE", `Érvénytelen JSON válasz: ${options.path}`, {
        status: response.status,
        cause,
      });
    }

    const parsed = options.schema.safeParse(json);
    if (!parsed.success) {
      throw new WooError("WOO.CONTRACT_MISMATCH", `Váratlan Store API-válasz: ${options.path}`, {
        status: response.status,
        cause: parsed.error,
      });
    }

    return { data: parsed.data, response };
  }

  async function requestCart(
    method: "GET" | "POST",
    path: string,
    session?: CartSession,
    body?: unknown,
  ): Promise<StoreCartResult> {
    const result = await rawRequest({
      method,
      path,
      body,
      session,
      schema: cartSchema,
      noStore: true,
      errorContext: "cart",
    });
    const nextSession = readSessionHeaders(result!.response, session);
    return {
      cart: result!.data,
      cartToken: nextSession.cartToken,
      nonce: nextSession.nonce,
    };
  }

  async function requestCheckout(
    method: "GET" | "POST",
    session: CartSession,
    body?: unknown,
  ): Promise<StoreCheckoutResult> {
    const result = await rawRequest({
      method,
      path: "/checkout",
      body,
      session,
      schema: checkoutResponseSchema,
      noStore: true,
      errorContext: "checkout",
    });
    const nextSession = readSessionHeaders(result!.response, session);
    return {
      checkout: result!.data,
      cartToken: nextSession.cartToken,
      nonce: nextSession.nonce,
    };
  }

  return {
    async getProducts(query = {}, cache) {
      const result = await rawRequest({
        method: "GET",
        path: "/products",
        params: {
          category: query.category,
          page: query.page,
          per_page: query.perPage ?? 24,
          search: query.search,
          min_price: query.minPrice,
          max_price: query.maxPrice,
          stock_status: query.stockStatus,
          orderby: query.orderby,
          order: query.order,
          on_sale: query.onSale,
        },
        schema: productListSchema,
        cache,
      });
      return result!.data;
    },
    async getProductById(id, cache) {
      const result = await rawRequest({
        method: "GET",
        path: `/products/${id}`,
        schema: productSchema,
        cache,
        allowNotFound: true,
      });
      return result ? result.data : null;
    },
    async getProductBySlug(slug, cache) {
      const result = await rawRequest({
        method: "GET",
        path: "/products",
        params: { slug },
        schema: productListSchema,
        cache,
      });
      return result!.data[0] ?? null;
    },
    async getCategories(cache) {
      const result = await rawRequest({
        method: "GET",
        path: "/products/categories",
        params: { per_page: 100 },
        schema: categoryListSchema,
        cache,
      });
      return result!.data;
    },
    async getAttributes(cache) {
      const result = await rawRequest({
        method: "GET",
        path: "/products/attributes",
        schema: attributeListSchema,
        cache,
      });
      return result!.data;
    },
    async getAttributeTerms(attributeId, cache) {
      const result = await rawRequest({
        method: "GET",
        path: `/products/attributes/${attributeId}/terms`,
        params: { per_page: 100 },
        schema: attributeTermListSchema,
        cache,
      });
      return result!.data;
    },
    getCart(session) {
      return requestCart("GET", "/cart", session);
    },
    addCartItem(input, session) {
      return requestCart("POST", "/cart/add-item", session, input);
    },
    updateCartItem(input, session) {
      return requestCart("POST", "/cart/update-item", session, input);
    },
    removeCartItem(input, session) {
      return requestCart("POST", "/cart/remove-item", session, input);
    },
    applyCoupon(input, session) {
      return requestCart("POST", "/cart/apply-coupon", session, input);
    },
    removeCoupon(input, session) {
      return requestCart("POST", "/cart/remove-coupon", session, input);
    },
    selectShippingRate(input, session) {
      return requestCart("POST", "/cart/select-shipping-rate", session, {
        package_id: input.packageId ?? 0,
        rate_id: input.rateId,
      });
    },
    getCheckout(session) {
      return requestCheckout("GET", session);
    },
    submitCheckout(input, session) {
      return requestCheckout("POST", session, input);
    },
  };
}

/**
 * Brandhez kötött Store API belépési pont: a végpontot kizárólag a brand `baseUrlEnv` változójából
 * oldja fel, így a brandek adatai nem keveredhetnek.
 */
export function createWooClient(brand: Brand, options?: WooClientOptions): WooStoreClient {
  const baseUrl = resolveBrandBaseUrl(brand, options?.env);
  const store = createStoreClient({
    baseUrl,
    fetch: options?.fetch,
    timeoutMs: options?.timeoutMs,
  });
  return {
    brandId: brand.id,
    ...store,
  };
}
