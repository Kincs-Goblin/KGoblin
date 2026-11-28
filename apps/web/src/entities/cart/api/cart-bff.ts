import "server-only";

import type { Brand } from "@kg/brand-config";
import {
  isWooError,
  type CartSession,
  type StoreCart,
  type StoreCartResult,
  type StoreClient,
} from "@kg/woo-client";
import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";

import {
  bffNoStoreHeaders,
  CART_RATE_LIMIT_BINDING,
  CART_RATE_LIMIT_PERIOD_SECONDS,
  checkBffRateLimit,
  getBffClientIp,
  getStoreClient,
  isMutatingOriginAllowed,
  isSecureBffCookie,
  parseBoundedJsonBody,
  resetBffRateLimiter,
  type BffRateLimitDecision,
  type BffRateLimiter,
} from "@/shared/api/index.server";
import { resolveRequestBrand } from "@/shared/config";
import { errorCatalog, type ErrorCode } from "@/shared/lib/errors";

import { MAX_QUANTITY_PER_LINE } from "../model/cart-optimistic";
import { createEmptyCartDto, type CartDto, type CartFreeShippingProgressDto } from "../model/types";

export { CART_RATE_LIMIT_BINDING, CART_RATE_LIMIT_PERIOD_SECONDS };
export type CartRateLimitDecision = BffRateLimitDecision;
export type CartRateLimiter = BffRateLimiter;

const COOKIE_MAX_AGE_SECONDS = 60 * 60 * 24 * 14; // 14 nap
const MAX_JSON_BODY_BYTES = 16 * 1024;

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
  /** Felülírja a Workers binding / memóriabeli tartalék választását (teszt). */
  rateLimiter?: CartRateLimiter;
  /** A memóriabeli tartalék limiter paraméterei. */
  rateLimit?: {
    maxRequests: number;
    windowMs: number;
  };
};

export function resetCartRateLimiter(): void {
  resetBffRateLimiter();
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

function computeFreeShippingProgress(
  cart: StoreCart,
  brand: Brand,
): CartFreeShippingProgressDto | null {
  const threshold = brand.merchandising.freeShippingThresholdMinor;
  if (!threshold) return null;
  if (cart.items_count === 0) return null;
  if (cart.totals.currency_code !== brand.currency) {
    return null;
  }

  const country = (cart.shipping_address?.country || "HU").toUpperCase();
  if (country !== "HU") {
    return null;
  }

  // Kizárólag a Woo `free_shipping` metódusa jelent ingyenes kiszállítási jogosultságot
  // (egy 0 Ft-os személyes átvételi mód nem).
  const hasFreeRate = cart.shipping_rates.some((pkg) =>
    pkg.shipping_rates.some((rate) => rate.method_id === "free_shipping"),
  );
  const itemsMinor = Number.parseInt(cart.totals.total_items, 10) || 0;
  const discountMinor = Number.parseInt(cart.totals.total_discount, 10) || 0;
  const netItemsMinor = Math.max(0, itemsMinor - discountMinor);
  const minorUnit = cart.totals.currency_minor_unit;
  const currency = cart.totals.currency_code;

  const eligible = hasFreeRate;
  const remainingMinor = eligible ? 0 : Math.max(0, threshold - netItemsMinor);
  const progressPercent = eligible
    ? 100
    : Math.min(99, Math.max(0, Math.round((netItemsMinor / threshold) * 100)));

  return {
    threshold: { amount: String(threshold), currency, minorUnit },
    remaining: { amount: String(remainingMinor), currency, minorUnit },
    eligible,
    progressPercent,
  };
}

export function mapStoreCartToDto(cart: StoreCart, brand?: Brand): CartDto {
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
    freeShippingProgress: brand ? computeFreeShippingProgress(cart, brand) : null,
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
    { status: entry.status, headers: bffNoStoreHeaders(options?.headers) },
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
  const resolveBrand = options.deps?.resolveBrand ?? resolveRequestBrand;
  const brand = resolveBrand(request);
  if (!brand) {
    return jsonError("BRAND.UNKNOWN_HOST");
  }

  if (options.mutating && !isMutatingOriginAllowed(request)) {
    return jsonError("CART.INVALID_INPUT");
  }

  const secure = isSecureBffCookie(request, options.deps?.isSecure);
  // Kizárólag a feloldott brand saját cookie-ját olvassuk (brand-elkülönítés).
  const cookieRaw = request.cookies.get(getCartCookieName(brand.id))?.value;
  let session = decodeCartCookie(cookieRaw);

  // Cookie nélküli vagy sérült cookie-jú lekérés: nincs kosár, nem hívjuk a Woo-t és nem nyitunk sessiont.
  if (!options.mutating && !session?.cartToken) {
    const response = NextResponse.json(
      { ok: true, cart: createEmptyCartDto(brand.currency) },
      { status: 200, headers: bffNoStoreHeaders() },
    );
    if (cookieRaw) {
      clearCartCookie(response, brand.id, secure);
    }
    return response;
  }

  // Minden Woo-t érő kérés (mutáció és cookie-s lekérés) a brand + kliens-IP kulcson korlátozott (ADR-0018).
  const rateCheck = await checkBffRateLimit(`${brand.id}:${getBffClientIp(request)}`, options.deps);
  if (!rateCheck.allowed) {
    return jsonError("CART.RATE_LIMITED", {
      headers: { "Retry-After": String(rateCheck.retryAfterSeconds) },
    });
  }

  let parsedBody = undefined as TBody;
  if (options.bodySchema) {
    const parsed = await parseBoundedJsonBody(request, options.bodySchema, MAX_JSON_BODY_BYTES);
    if (!parsed.ok) return jsonError("CART.INVALID_INPUT");
    parsedBody = parsed.data;
  }

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
      { ok: true, cart: mapStoreCartToDto(result.cart, brand) },
      { status: 200, headers: bffNoStoreHeaders() },
    );
    applyCartCookie(response, brand.id, result, secure);
    return response;
  } catch (error) {
    if (isWooError(error)) {
      if (error.code === "CART.SESSION_INVALID") {
        // Olvasó GET-nél lejárt cookie esetén csendben töröljük a cookie-t és üres kosárral térünk vissza,
        // új Woo-session felesleges létrehozása nélkül.
        if (!options.mutating) {
          const response = NextResponse.json(
            { ok: true, cart: createEmptyCartDto(brand.currency) },
            { status: 200, headers: bffNoStoreHeaders() },
          );
          clearCartCookie(response, brand.id, secure);
          return response;
        }

        // Mutáló kérésnél friss kosarat inicializálunk és frissítjük (vagy töröljük) a cookie-t.
        try {
          const fresh = await storeClient.getCart();
          const response = jsonError("CART.SESSION_INVALID", {
            cart: mapStoreCartToDto(fresh.cart, brand),
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
