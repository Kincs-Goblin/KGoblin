import "server-only";

import { getBrandById, resolveBrandByHost, type Brand } from "@kg/brand-config";
import {
  isWooError,
  type CartSession,
  type StoreCart,
  type StoreCartResult,
  type StoreClient,
} from "@kg/woo-client";
import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";

import { errorCatalog, type ErrorCode } from "../lib/errors";
import type { CartDto, CartFreeShippingProgressDto } from "./cart-types";
import { getStoreClient } from "./store-client";

const COOKIE_MAX_AGE_SECONDS = 60 * 60 * 24 * 14; // 14 nap
const DEFAULT_RATE_LIMIT_MAX = 60;
const DEFAULT_RATE_LIMIT_WINDOW_MS = 60_000;
const MAX_RATE_LIMIT_KEYS = 2000;
const MAX_JSON_BODY_BYTES = 16 * 1024;
const MAX_QUANTITY_PER_LINE = 30;
/** Magyarországi ingyenes szállítási küszöb HUF-ban (minor unit, egyezik a Woo seeddel). */
const FREE_SHIPPING_THRESHOLD_HUF_MINOR = 25_000;

const cookiePayloadSchema = z.object({
  cartToken: z.string().min(1).max(2048),
  nonce: z.string().min(1).max(512).optional(),
});

const addItemBodySchema = z.object({
  id: z.number().int().positive(),
  quantity: z.number().int().min(1).max(MAX_QUANTITY_PER_LINE).default(1),
  variation: z
    .array(
      z.object({
        attribute: z.string().trim().min(1).max(120),
        value: z.string().trim().min(1).max(200),
      }),
    )
    .max(10)
    .optional(),
});

const updateItemBodySchema = z.object({
  key: z.string().trim().min(1).max(128),
  quantity: z.number().int().min(0).max(MAX_QUANTITY_PER_LINE),
});

const removeItemBodySchema = z.object({
  key: z.string().trim().min(1).max(128),
});

const couponBodySchema = z.object({
  code: z.string().trim().min(1).max(64),
});

const selectShippingBodySchema = z.object({
  packageId: z.number().int().min(0).default(0),
  rateId: z.string().trim().min(1).max(128),
});

const updateShippingAddressBodySchema = z.object({
  country: z
    .string()
    .trim()
    .toUpperCase()
    .regex(/^[A-Z]{2}$/)
    .default("HU"),
  postcode: z.string().trim().min(2).max(16),
  city: z.string().trim().max(120).optional(),
});

export type CartBffDeps = {
  resolveBrand?: (request: NextRequest) => Brand | undefined;
  getStoreClient?: (brand: Brand) => StoreClient;
  now?: () => number;
  isSecure?: boolean;
  rateLimit?: {
    maxRequests: number;
    windowMs: number;
  };
};

/**
 * Izolátum-szintű csúszóablakos rate limiter (Cloudflare Workers alatt élesben Cloudflare WAF /
 * Rate Limiting szabály egészíti ki). Felső kulcsszámmal védett a memória-kimerítés ellen.
 */
const rateLimitStore = new Map<string, number[]>();

export function resetCartRateLimiter(): void {
  rateLimitStore.clear();
}

export function getCartCookieName(brandId: string): string {
  return `kg_${brandId}_cart`;
}

function encodeCartCookie(session: { cartToken: string; nonce?: string }): string {
  const payload = session.nonce
    ? { cartToken: session.cartToken, nonce: session.nonce }
    : { cartToken: session.cartToken };
  return Buffer.from(JSON.stringify(payload), "utf8").toString("base64url");
}

function decodeCartCookie(raw: string | undefined): CartSession | undefined {
  if (!raw) return undefined;
  try {
    const decoded = Buffer.from(raw, "base64url").toString("utf8");
    const parsed = cookiePayloadSchema.safeParse(JSON.parse(decoded));
    if (!parsed.success) return undefined;
    return {
      cartToken: parsed.data.cartToken,
      ...(parsed.data.nonce ? { nonce: parsed.data.nonce } : {}),
    };
  } catch {
    return undefined;
  }
}

function defaultResolveBrand(request: NextRequest): Brand | undefined {
  if (process.env.NODE_ENV === "development" && request.nextUrl.searchParams.has("brand")) {
    const queryBrand = request.nextUrl.searchParams.get("brand");
    return queryBrand ? getBrandById(queryBrand) : undefined;
  }
  return resolveBrandByHost(request.headers.get("host"));
}

function isSecureCookie(request: NextRequest, deps?: CartBffDeps): boolean {
  if (deps?.isSecure !== undefined) return deps.isSecure;
  const appEnv = process.env.NEXT_PUBLIC_APP_ENV;
  if (appEnv === "production" || appEnv === "demo") return true;
  const forwardedProto = request.headers.get("x-forwarded-proto")?.split(",")[0]?.trim();
  return forwardedProto === "https" || request.nextUrl.protocol === "https:";
}

function getClientIp(request: NextRequest): string {
  const cfIp = request.headers.get("cf-connecting-ip")?.trim();
  if (cfIp) return cfIp;
  const forwarded = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim();
  if (forwarded) return forwarded;
  return "local";
}

function checkRateLimit(
  brandId: string,
  ip: string,
  nowMs: number,
  maxRequests: number,
  windowMs: number,
): { allowed: true } | { allowed: false; retryAfterSeconds: number } {
  const key = `${brandId}:${ip}`;
  const cutoff = nowMs - windowMs;
  const existing = (rateLimitStore.get(key) ?? []).filter((ts) => ts > cutoff);

  if (existing.length >= maxRequests) {
    const oldest = existing[0] ?? nowMs;
    const retryAfterSeconds = Math.max(1, Math.ceil((oldest + windowMs - nowMs) / 1000));
    rateLimitStore.set(key, existing);
    return { allowed: false, retryAfterSeconds };
  }

  existing.push(nowMs);
  rateLimitStore.delete(key);
  rateLimitStore.set(key, existing);

  if (rateLimitStore.size > MAX_RATE_LIMIT_KEYS) {
    for (const [entryKey, timestamps] of rateLimitStore.entries()) {
      const fresh = timestamps.filter((ts) => ts > cutoff);
      if (fresh.length === 0) {
        rateLimitStore.delete(entryKey);
      } else {
        rateLimitStore.set(entryKey, fresh);
      }
    }
    while (rateLimitStore.size > MAX_RATE_LIMIT_KEYS) {
      const oldestKey = rateLimitStore.keys().next().value;
      if (oldestKey === undefined) break;
      rateLimitStore.delete(oldestKey);
    }
  }

  return { allowed: true };
}

function isOriginAllowed(request: NextRequest): boolean {
  const origin = request.headers.get("origin");
  if (!origin) return true;
  const host = request.headers.get("host")?.trim().toLowerCase();
  if (!host) return false;
  try {
    return new URL(origin).host.toLowerCase() === host;
  } catch {
    return false;
  }
}

function computeFreeShippingProgress(cart: StoreCart): CartFreeShippingProgressDto | null {
  if (cart.items_count === 0) return null;
  if (cart.totals.currency_code !== "HUF" || cart.totals.currency_minor_unit !== 0) {
    return null;
  }

  const country = (cart.shipping_address?.country || "HU").toUpperCase();
  if (country !== "HU") {
    return null;
  }

  const hasFreeRate = cart.shipping_rates.some((pkg) =>
    pkg.shipping_rates.some((rate) => rate.method_id === "free_shipping" || rate.price === "0"),
  );
  const threshold = FREE_SHIPPING_THRESHOLD_HUF_MINOR;
  const itemsMinor = Number.parseInt(cart.totals.total_items, 10) || 0;
  const discountMinor = Number.parseInt(cart.totals.total_discount, 10) || 0;
  const netItemsMinor = Math.max(0, itemsMinor - discountMinor);

  // A jogosultság egyetlen forrása a Woo által ténylegesen felajánlott ingyenes szállítási mód.
  const eligible = hasFreeRate;
  const remainingMinor = eligible ? 0 : Math.max(0, threshold - netItemsMinor);
  const progressPercent = eligible
    ? 100
    : Math.min(99, Math.max(0, Math.round((netItemsMinor / threshold) * 100)));

  return {
    threshold: { amount: String(threshold), currency: "HUF", minorUnit: 0 },
    remaining: { amount: String(remainingMinor), currency: "HUF", minorUnit: 0 },
    eligible,
    progressPercent,
  };
}

export function mapStoreCartToDto(cart: StoreCart): CartDto {
  const currency = cart.totals.currency_code;
  const minorUnit = cart.totals.currency_minor_unit;

  return {
    items: cart.items.map((item) => ({
      key: item.key,
      productId: item.id,
      quantity: item.quantity,
      name: item.name,
      slug: item.slug,
      sku: item.sku,
      image: item.images[0] ? { src: item.images[0].src, alt: item.images[0].alt } : null,
      variation: item.variation.map((v) => ({ attribute: v.attribute, value: v.value })),
      unitPrice: {
        amount: item.prices.price,
        currency: item.prices.currency_code,
        minorUnit: item.prices.currency_minor_unit,
      },
      regularPrice: {
        amount: item.prices.regular_price,
        currency: item.prices.currency_code,
        minorUnit: item.prices.currency_minor_unit,
      },
      lineSubtotal: {
        amount: item.totals.line_subtotal,
        currency: item.totals.currency_code,
        minorUnit: item.totals.currency_minor_unit,
      },
      lineTotal: {
        amount: item.totals.line_total,
        currency: item.totals.currency_code,
        minorUnit: item.totals.currency_minor_unit,
      },
    })),
    coupons: cart.coupons.map((coupon) => ({
      code: coupon.code,
      discountType: coupon.discount_type,
      totalDiscount: {
        amount: coupon.totals.total_discount,
        currency: coupon.totals.currency_code,
        minorUnit: coupon.totals.currency_minor_unit,
      },
    })),
    shippingPackages: cart.shipping_rates.map((pkg) => ({
      packageId: pkg.package_id,
      name: pkg.name,
      rates: pkg.shipping_rates.map((rate) => ({
        rateId: rate.rate_id,
        name: rate.name,
        description: rate.description,
        deliveryTime: rate.delivery_time,
        price: {
          amount: rate.price,
          currency: rate.currency_code,
          minorUnit: rate.currency_minor_unit,
        },
        methodId: rate.method_id,
        selected: rate.selected,
      })),
    })),
    shippingAddress: {
      country: cart.shipping_address?.country || "HU",
      postcode: cart.shipping_address?.postcode || "",
      city: cart.shipping_address?.city || "",
    },
    totals: {
      items: { amount: cart.totals.total_items, currency, minorUnit },
      discount: { amount: cart.totals.total_discount, currency, minorUnit },
      shipping:
        cart.totals.total_shipping !== null
          ? { amount: cart.totals.total_shipping, currency, minorUnit }
          : null,
      tax: { amount: cart.totals.total_tax, currency, minorUnit },
      total: { amount: cart.totals.total_price, currency, minorUnit },
    },
    itemsCount: cart.items_count,
    needsShipping: cart.needs_shipping,
    needsPayment: cart.needs_payment,
    freeShippingProgress: computeFreeShippingProgress(cart),
  };
}

function baseHeaders(extra?: Record<string, string>): Record<string, string> {
  return {
    "Cache-Control": "no-store",
    Vary: "Host, Cookie",
    ...extra,
  };
}

function jsonError(
  code: ErrorCode,
  options?: {
    cart?: CartDto;
    headers?: Record<string, string>;
  },
): NextResponse {
  const entry = errorCatalog[code];
  return NextResponse.json(
    {
      ok: false,
      code,
      message: entry.message,
      ...(options?.cart ? { cart: options.cart } : {}),
    },
    { status: entry.status, headers: baseHeaders(options?.headers) },
  );
}

function applyCartCookie(
  response: NextResponse,
  brandId: string,
  session: { cartToken?: string; nonce?: string },
  secure: boolean,
): void {
  if (!session.cartToken) return;
  response.cookies.set(
    getCartCookieName(brandId),
    encodeCartCookie({
      cartToken: session.cartToken,
      ...(session.nonce ? { nonce: session.nonce } : {}),
    }),
    {
      httpOnly: true,
      sameSite: "lax",
      secure,
      path: "/",
      maxAge: COOKIE_MAX_AGE_SECONDS,
    },
  );
}

function clearCartCookie(response: NextResponse, brandId: string, secure: boolean): void {
  response.cookies.set(getCartCookieName(brandId), "", {
    httpOnly: true,
    sameSite: "lax",
    secure,
    path: "/",
    maxAge: 0,
  });
}

async function parseBoundedJsonBody<T extends z.ZodType>(
  request: NextRequest,
  schema: T,
): Promise<{ ok: true; data: z.infer<T> } | { ok: false }> {
  const contentType = request.headers.get("content-type")?.toLowerCase() ?? "";
  if (!contentType.includes("application/json")) {
    return { ok: false };
  }

  let text: string;
  try {
    text = await request.text();
  } catch {
    return { ok: false };
  }
  if (Buffer.byteLength(text, "utf8") > MAX_JSON_BODY_BYTES) {
    return { ok: false };
  }

  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch {
    return { ok: false };
  }
  const parsed = schema.safeParse(raw);
  if (!parsed.success) return { ok: false };
  return { ok: true, data: parsed.data };
}

function mapWooCodeToErrorCode(code: string): ErrorCode {
  if (code in errorCatalog) {
    return code as ErrorCode;
  }
  return "WOO.UNAVAILABLE";
}

async function executeCartOperation<TBody = undefined>(
  request: NextRequest,
  options: {
    mutating: boolean;
    bodySchema?: z.ZodType<TBody>;
    run: (
      client: StoreClient,
      session: CartSession | undefined,
      body: TBody,
    ) => Promise<StoreCartResult>;
    deps?: CartBffDeps;
  },
): Promise<NextResponse> {
  const resolveBrand = options.deps?.resolveBrand ?? defaultResolveBrand;
  const brand = resolveBrand(request);
  if (!brand) {
    return jsonError("BRAND.UNKNOWN_HOST");
  }

  if (options.mutating) {
    if (!isOriginAllowed(request)) {
      return jsonError("CART.INVALID_INPUT");
    }

    const now = options.deps?.now?.() ?? Date.now();
    const maxRequests = options.deps?.rateLimit?.maxRequests ?? DEFAULT_RATE_LIMIT_MAX;
    const windowMs = options.deps?.rateLimit?.windowMs ?? DEFAULT_RATE_LIMIT_WINDOW_MS;
    const rateCheck = checkRateLimit(brand.id, getClientIp(request), now, maxRequests, windowMs);
    if (!rateCheck.allowed) {
      return jsonError("CART.RATE_LIMITED", {
        headers: { "Retry-After": String(rateCheck.retryAfterSeconds) },
      });
    }
  }

  let parsedBody = undefined as TBody;
  if (options.bodySchema) {
    const parsed = await parseBoundedJsonBody(request, options.bodySchema);
    if (!parsed.ok) return jsonError("CART.INVALID_INPUT");
    parsedBody = parsed.data;
  }

  const secure = isSecureCookie(request, options.deps);
  // Kizárólag a feloldott brand saját cookie-ját olvassuk (brand-elkülönítés).
  const cookieRaw = request.cookies.get(getCartCookieName(brand.id))?.value;
  let session = decodeCartCookie(cookieRaw);
  const storeClient = (options.deps?.getStoreClient ?? getStoreClient)(brand);

  try {
    // Valódi Woo Store API minden mutáló kéréshez Cart-Token + Nonce fejlécet kér; ha még nincs
    // session cookie, a mutáció előtt inicializálunk egy friss kosarat.
    if (options.mutating && !session?.cartToken) {
      const initialized = await storeClient.getCart();
      session = {
        ...(initialized.cartToken ? { cartToken: initialized.cartToken } : {}),
        ...(initialized.nonce ? { nonce: initialized.nonce } : {}),
      };
    }

    const result = await options.run(storeClient, session, parsedBody);
    const response = NextResponse.json(
      { ok: true, cart: mapStoreCartToDto(result.cart) },
      { status: 200, headers: baseHeaders() },
    );
    applyCartCookie(response, brand.id, result, secure);
    return response;
  } catch (error) {
    if (isWooError(error)) {
      if (error.code === "CART.SESSION_INVALID") {
        // Lejárt vagy érvénytelen token: friss kosarat inicializálunk és frissítjük (vagy töröljük) a cookie-t.
        try {
          const fresh = await storeClient.getCart();
          const response = jsonError("CART.SESSION_INVALID", {
            cart: mapStoreCartToDto(fresh.cart),
          });
          if (fresh.cartToken) {
            applyCartCookie(response, brand.id, fresh, secure);
          } else {
            clearCartCookie(response, brand.id, secure);
          }
          return response;
        } catch {
          const response = jsonError("CART.SESSION_INVALID");
          clearCartCookie(response, brand.id, secure);
          return response;
        }
      }

      if (error.code === "WOO.CONTRACT_MISMATCH" || error.code === "WOO.UNAVAILABLE") {
        console.error("[cart-bff] Woo Store API hiba", {
          brandId: brand.id,
          code: error.code,
          wooCode: error.wooCode,
          status: error.status,
        });
      }

      return jsonError(mapWooCodeToErrorCode(error.code));
    }

    console.error("[cart-bff] Váratlan hiba", { brandId: brand.id });
    return jsonError("WOO.UNAVAILABLE");
  }
}

export function handleCartGet(request: NextRequest, deps?: CartBffDeps): Promise<NextResponse> {
  return executeCartOperation(request, {
    mutating: false,
    run: (client, session) => client.getCart(session),
    deps,
  });
}

export function handleCartClear(request: NextRequest, deps?: CartBffDeps): Promise<NextResponse> {
  return executeCartOperation(request, {
    mutating: true,
    run: (client, session) => client.clearCart(session),
    deps,
  });
}

export function handleCartAddItem(request: NextRequest, deps?: CartBffDeps): Promise<NextResponse> {
  return executeCartOperation(request, {
    mutating: true,
    bodySchema: addItemBodySchema,
    run: (client, session, body) => client.addCartItem(body, session),
    deps,
  });
}

export function handleCartUpdateItem(
  request: NextRequest,
  deps?: CartBffDeps,
): Promise<NextResponse> {
  return executeCartOperation(request, {
    mutating: true,
    bodySchema: updateItemBodySchema,
    run: (client, session, body) =>
      body.quantity === 0
        ? client.removeCartItem({ key: body.key }, session)
        : client.updateCartItem(body, session),
    deps,
  });
}

export function handleCartRemoveItem(
  request: NextRequest,
  deps?: CartBffDeps,
): Promise<NextResponse> {
  return executeCartOperation(request, {
    mutating: true,
    bodySchema: removeItemBodySchema,
    run: (client, session, body) => client.removeCartItem(body, session),
    deps,
  });
}

export function handleCartApplyCoupon(
  request: NextRequest,
  deps?: CartBffDeps,
): Promise<NextResponse> {
  return executeCartOperation(request, {
    mutating: true,
    bodySchema: couponBodySchema,
    run: (client, session, body) => client.applyCoupon(body, session),
    deps,
  });
}

export function handleCartRemoveCoupon(
  request: NextRequest,
  deps?: CartBffDeps,
): Promise<NextResponse> {
  return executeCartOperation(request, {
    mutating: true,
    bodySchema: couponBodySchema,
    run: (client, session, body) => client.removeCoupon(body, session),
    deps,
  });
}

export function handleCartSelectShipping(
  request: NextRequest,
  deps?: CartBffDeps,
): Promise<NextResponse> {
  return executeCartOperation(request, {
    mutating: true,
    bodySchema: selectShippingBodySchema,
    run: (client, session, body) => client.selectShippingRate(body, session),
    deps,
  });
}

export function handleCartUpdateShippingAddress(
  request: NextRequest,
  deps?: CartBffDeps,
): Promise<NextResponse> {
  return executeCartOperation(request, {
    mutating: true,
    bodySchema: updateShippingAddressBodySchema,
    run: (client, session, body) =>
      client.updateCustomer(
        {
          shipping_address: {
            country: body.country,
            postcode: body.postcode,
            ...(body.city !== undefined ? { city: body.city } : {}),
          },
        },
        session,
      ),
    deps,
  });
}
