import type { Brand } from "@kg/brand-config";
import type { z } from "zod";

import { resolveBrandRestCredentials } from "./env";
import { mapWooErrorCode, WooError } from "../errors";
import { wooApiErrorBodySchema } from "../store/schemas";
import {
  restOrderNoteSchema,
  restOrderSchema,
  restProductBatchResponseSchema,
  restProductListSchema,
  restProductSchema,
  type RestOrder,
  type RestOrderNote,
  type RestProduct,
  type RestProductBatchResponse,
} from "./schemas";

export type RestClientOptions = {
  baseUrl: string;
  consumerKey: string;
  consumerSecret: string;
  fetch?: typeof fetch;
  timeoutMs?: number;
};

export type WooRestClientOptions = {
  env?: Record<string, string | undefined>;
  fetch?: typeof fetch;
  timeoutMs?: number;
};

export type RestListProductsQuery = {
  page?: number;
  perPage?: number;
  sku?: string;
  status?: "draft" | "pending" | "private" | "publish" | "any";
};

export type RestProductWriteInput = {
  name?: string;
  slug?: string;
  type?: string;
  status?: "draft" | "pending" | "private" | "publish";
  sku?: string;
  regular_price?: string;
  sale_price?: string;
  description?: string;
  short_description?: string;
  manage_stock?: boolean;
  stock_quantity?: number | null;
  stock_status?: "instock" | "outofstock" | "onbackorder";
  categories?: Array<{ id: number }>;
  meta_data?: Array<{ key: string; value: unknown }>;
};

export type RestProductBatchInput = {
  create?: RestProductWriteInput[];
  update?: Array<RestProductWriteInput & { id: number }>;
  delete?: number[];
};

export type RestOrderUpdateInput = {
  status?: string;
  transaction_id?: string;
  meta_data?: Array<{ key: string; value: unknown }>;
};

export type RestClient = {
  listProducts(query?: RestListProductsQuery): Promise<RestProduct[]>;
  getProduct(id: number): Promise<RestProduct | null>;
  batchProducts(input: RestProductBatchInput): Promise<RestProductBatchResponse>;
  getOrder(id: number): Promise<RestOrder | null>;
  updateOrder(id: number, input: RestOrderUpdateInput): Promise<RestOrder>;
  addOrderNote(
    orderId: number,
    note: string,
    options?: { customerNote?: boolean },
  ): Promise<RestOrderNote>;
};

export type WooRestClient = RestClient & {
  readonly brandId: string;
};

const utf8Encoder = new TextEncoder();

function encodeBasicAuth(key: string, secret: string): string {
  const bytes = utf8Encoder.encode(`${key}:${secret}`);
  let binary = "";
  for (let i = 0; i < bytes.length; i++) {
    binary += String.fromCharCode(bytes[i]!);
  }
  return btoa(binary);
}

function isLoopbackHost(hostname: string): boolean {
  const normalized = hostname.toLowerCase();
  return normalized === "localhost" || normalized === "127.0.0.1" || normalized === "[::1]";
}

function rfc3986Encode(value: string): string {
  return encodeURIComponent(value).replace(
    /[!'()*]/g,
    (ch) => `%${ch.charCodeAt(0).toString(16).toUpperCase()}`,
  );
}

function bytesToBase64(bytes: Uint8Array): string {
  let binary = "";
  for (let i = 0; i < bytes.length; i++) {
    binary += String.fromCharCode(bytes[i]!);
  }
  return btoa(binary);
}

function createOAuthNonce(): string {
  const bytes = new Uint8Array(16);
  globalThis.crypto.getRandomValues(bytes);
  return Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
}

/**
 * WooCommerce 11.x plain HTTP alatt csak RFC 5849 one-legged OAuth 1.0a aláírást fogad el
 * (`is_ssl()` hamis esetén a query-stringes `consumer_secret` elutasításra kerül).
 * Ezt kizárólag lokális loopback fejlesztői/contract-teszt végponton használjuk.
 */
async function signLoopbackOAuth1Request(
  method: "GET" | "POST" | "PUT",
  url: URL,
  consumerKey: string,
  consumerSecret: string,
): Promise<void> {
  url.searchParams.set("oauth_consumer_key", consumerKey);
  url.searchParams.set("oauth_timestamp", String(Math.floor(Date.now() / 1000)));
  url.searchParams.set("oauth_nonce", createOAuthNonce());
  url.searchParams.set("oauth_signature_method", "HMAC-SHA256");

  const sortedEntries = Array.from(url.searchParams.entries()).sort(([a], [b]) =>
    a < b ? -1 : a > b ? 1 : 0,
  );
  const encodedPairs = sortedEntries.map(([k, v]) =>
    rfc3986Encode(`${rfc3986Encode(k)}=${rfc3986Encode(v)}`),
  );
  const baseUri = rfc3986Encode(`${url.origin}${url.pathname}`);
  const stringToSign = `${method.toUpperCase()}&${baseUri}&${encodedPairs.join("%26")}`;

  const cryptoKey = await globalThis.crypto.subtle.importKey(
    "raw",
    utf8Encoder.encode(`${consumerSecret}&`),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const sigBuffer = await globalThis.crypto.subtle.sign(
    "HMAC",
    cryptoKey,
    utf8Encoder.encode(stringToSign),
  );
  url.searchParams.set("oauth_signature", bytesToBase64(new Uint8Array(sigBuffer)));
}

function redactErrorReason(cause: unknown, key: string, secret: string): string | undefined {
  if (!(cause instanceof Error)) return undefined;
  let message = cause.message;
  if (key) {
    message = message.split(key).join("[REDACTED]");
    const encodedKey = encodeURIComponent(key);
    if (encodedKey !== key) {
      message = message.split(encodedKey).join("[REDACTED]");
    }
  }
  if (secret) message = message.split(secret).join("[REDACTED]");
  return message;
}

export function createRestClient({
  baseUrl,
  consumerKey,
  consumerSecret,
  fetch: fetchImpl = fetch,
  timeoutMs = 15000,
}: RestClientOptions): RestClient {
  const normalizedBase = baseUrl.replace(/\/+$/, "");
  let parsedBase: URL;
  try {
    parsedBase = new URL(normalizedBase);
  } catch (cause) {
    throw new WooError("WOO.UNAVAILABLE", "Érvénytelen Woo REST v3 alap URL.", { cause });
  }

  const isHttps = parsedBase.protocol === "https:";
  if (!isHttps && !(parsedBase.protocol === "http:" && isLoopbackHost(parsedBase.hostname))) {
    throw new WooError(
      "WOO.UNAVAILABLE",
      "A Woo REST v3 külső végpont csak HTTPS protokollon használható.",
    );
  }

  const root = `${normalizedBase}/wp-json/wc/v3`;

  async function request<T extends z.ZodType>(options: {
    method: "GET" | "POST" | "PUT";
    path: string;
    params?: Record<string, string | number | undefined>;
    body?: unknown;
    schema: T;
    allowNotFound?: boolean;
  }): Promise<z.infer<T> | null> {
    const url = new URL(`${root}${options.path}`);
    if (options.params) {
      for (const [k, v] of Object.entries(options.params)) {
        if (v !== undefined) url.searchParams.set(k, String(v));
      }
    }

    const headers: Record<string, string> = { Accept: "application/json" };
    if (isHttps) {
      headers.Authorization = `Basic ${encodeBasicAuth(consumerKey, consumerSecret)}`;
    } else {
      await signLoopbackOAuth1Request(options.method, url, consumerKey, consumerSecret);
    }

    if (options.body !== undefined) {
      headers["Content-Type"] = "application/json";
    }

    let response: Response;
    try {
      response = await fetchImpl(url, {
        method: options.method,
        headers,
        cache: "no-store",
        signal: AbortSignal.timeout(timeoutMs),
        ...(options.body !== undefined ? { body: JSON.stringify(options.body) } : {}),
      });
    } catch (cause) {
      const safeReason = redactErrorReason(cause, consumerKey, consumerSecret);
      throw new WooError(
        "WOO.UNAVAILABLE",
        `REST v3 nem elérhető: ${options.path}${safeReason ? ` (${safeReason})` : ""}`,
      );
    }

    if (options.allowNotFound && response.status === 404) {
      return null;
    }

    if (!response.ok) {
      if (response.status >= 500) {
        throw new WooError(
          "WOO.UNAVAILABLE",
          `REST v3 hiba (${response.status}): ${options.path}`,
          { status: response.status },
        );
      }

      const rawError = await response.json().catch(() => undefined);
      const parsedError = wooApiErrorBodySchema.safeParse(rawError);
      const wooCode = parsedError.success ? parsedError.data.code : undefined;
      const mappedCode = mapWooErrorCode(wooCode, response.status, "rest");
      const wooMessage = parsedError.success ? parsedError.data.message : undefined;

      throw new WooError(
        mappedCode,
        wooMessage || `REST v3 kérés elutasítva (${response.status}): ${options.path}`,
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
      throw new WooError("WOO.CONTRACT_MISMATCH", `Váratlan REST v3 válasz: ${options.path}`, {
        status: response.status,
        cause: parsed.error,
      });
    }

    return parsed.data;
  }

  return {
    async listProducts(query = {}) {
      const data = await request({
        method: "GET",
        path: "/products",
        params: {
          page: query.page,
          per_page: query.perPage ?? 50,
          sku: query.sku,
          status: query.status,
        },
        schema: restProductListSchema,
      });
      return data!;
    },
    getProduct(id) {
      return request({
        method: "GET",
        path: `/products/${id}`,
        schema: restProductSchema,
        allowNotFound: true,
      });
    },
    async batchProducts(input) {
      const data = await request({
        method: "POST",
        path: "/products/batch",
        body: input,
        schema: restProductBatchResponseSchema,
      });
      return data!;
    },
    getOrder(id) {
      return request({
        method: "GET",
        path: `/orders/${id}`,
        schema: restOrderSchema,
        allowNotFound: true,
      });
    },
    async updateOrder(id, input) {
      const data = await request({
        method: "PUT",
        path: `/orders/${id}`,
        body: input,
        schema: restOrderSchema,
      });
      return data!;
    },
    async addOrderNote(orderId, note, options) {
      const data = await request({
        method: "POST",
        path: `/orders/${orderId}/notes`,
        body: {
          note,
          customer_note: options?.customerNote ?? false,
        },
        schema: restOrderNoteSchema,
      });
      return data!;
    },
  };
}

/**
 * Brandhez kötött, kizárólag szerveroldali (`server-only`) WooCommerce REST v3 kliens.
 * A hitelesítő adatokat a brandhez tartozó környezeti változókból olvassa (`WOO_<BRAND>_*`).
 */
export function createWooRestClient(brand: Brand, options?: WooRestClientOptions): WooRestClient {
  const credentials = resolveBrandRestCredentials(brand, options?.env);
  const rest = createRestClient({
    ...credentials,
    fetch: options?.fetch,
    timeoutMs: options?.timeoutMs,
  });
  return {
    brandId: brand.id,
    ...rest,
  };
}
