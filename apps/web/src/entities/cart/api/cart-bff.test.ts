import { getBrandById, type Brand } from "@kg/brand-config";
import { WooError, type CartSession, type StoreClient } from "@kg/woo-client";
import {
  createFixtureStoreClient,
  fixtureCart,
  fixtureProducts,
  resetFixtureCartSessions,
} from "@kg/woo-client/fixtures";
import { getCloudflareContext } from "@opennextjs/cloudflare";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { NextRequest } from "next/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  CART_RATE_LIMIT_BINDING,
  CART_RATE_LIMIT_PERIOD_SECONDS,
  getCartCookieName,
  handleCartAddItem,
  handleCartApplyCoupon,
  handleCartClear,
  handleCartGet,
  handleCartRemoveCoupon,
  handleCartRemoveItem,
  handleCartSelectShipping,
  handleCartUpdateItem,
  handleCartUpdateShippingAddress,
  resetCartRateLimiter,
  type CartBffDeps,
} from "./cart-bff";

// Workersen kívül (Vitest) nincs Cloudflare-kontextus: alapból dob, a binding-teszt felülírja.
vi.mock("@opennextjs/cloudflare", () => ({
  getCloudflareContext: vi.fn(() => {
    throw new Error("nincs Cloudflare-kontextus");
  }),
}));

const gamerBrand = getBrandById("gamer")!;
const secondBrand: Brand = {
  ...structuredClone(gamerBrand),
  id: "masik",
  name: "Másik Shop",
  domains: ["masik.localhost"],
  woo: { baseUrlEnv: "WOO_MASIK_URL" },
  search: { index: "products_masik" },
};

function makeRequest(
  path: string,
  options?: {
    method?: string;
    host?: string;
    body?: unknown;
    cookies?: Record<string, string>;
    /** `cf-connecting-ip` */
    ip?: string;
    forwardedFor?: string;
    /** Alapból mutáló kérésnél a host saját originje; `null` = nincs Origin fejléc. */
    origin?: string | null;
    contentType?: string;
  },
): NextRequest {
  const headers = new Headers();
  const method = options?.method ?? "GET";
  if (options?.host) headers.set("host", options.host);
  if (options?.ip) headers.set("cf-connecting-ip", options.ip);
  if (options?.forwardedFor) headers.set("x-forwarded-for", options.forwardedFor);
  const origin =
    options?.origin === undefined && method !== "GET"
      ? `http://${options?.host ?? "gamer.localhost"}`
      : options?.origin;
  if (origin) headers.set("origin", origin);
  if (options?.cookies) {
    headers.set(
      "cookie",
      Object.entries(options.cookies)
        .map(([k, v]) => `${k}=${v}`)
        .join("; "),
    );
  }
  if (options?.body !== undefined) {
    headers.set("content-type", options.contentType ?? "application/json");
  }
  return new NextRequest(`http://${options?.host ?? "gamer.localhost"}${path}`, {
    method,
    headers,
    ...(options?.body !== undefined ? { body: JSON.stringify(options.body) } : {}),
  });
}

describe("Cart BFF route handlerek", () => {
  beforeEach(() => {
    resetCartRateLimiter();
    resetFixtureCartSessions();
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    vi.restoreAllMocks();
    // A Cloudflare-kontextus mockját minden teszt után visszaállítjuk (elbukó assertion esetén is).
    vi.mocked(getCloudflareContext).mockImplementation(() => {
      throw new Error("nincs Cloudflare-kontextus");
    });
  });

  it("ismeretlen hostra fail-closed 404 BRAND.UNKNOWN_HOST választ ad no-store fejléccel", async () => {
    const req = makeRequest("/api/cart", { host: "ismeretlen.example.test" });
    const res = await handleCartGet(req);
    const json = await res.json();

    expect(res.status).toBe(404);
    expect(res.headers.get("cache-control")).toBe("no-store");
    expect(json).toMatchObject({ ok: false, code: "BRAND.UNKNOWN_HOST" });
  });

  it("beállítja a brand-előtagos httpOnly cookie-t és végigviszi a kosárműveleteket", async () => {
    const deps: CartBffDeps = {
      getStoreClient: (brand) => createFixtureStoreClient({ brandId: brand.id }),
      isSecure: true,
    };

    const pad = fixtureProducts.find((p) => p.slug.includes("titanweave"))!;
    const firstAddRes = await handleCartAddItem(
      makeRequest("/api/cart/items", {
        method: "POST",
        host: "gamer.localhost",
        body: { id: pad.id, quantity: 1 },
      }),
      deps,
    );
    expect(firstAddRes.status).toBe(200);
    expect(firstAddRes.headers.get("cache-control")).toBe("no-store");

    const cookie = firstAddRes.cookies.get(getCartCookieName("gamer"));
    expect(cookie).toBeDefined();
    expect(cookie?.httpOnly).toBe(true);
    expect(cookie?.sameSite).toBe("lax");
    expect(cookie?.secure).toBe(true);

    const addRes = await handleCartAddItem(
      makeRequest("/api/cart/items", {
        method: "POST",
        host: "gamer.localhost",
        body: { id: pad.id, quantity: 1 },
        cookies: { [getCartCookieName("gamer")]: cookie!.value },
      }),
      deps,
    );
    const addJson = await addRes.json();
    expect(addRes.status).toBe(200);
    expect(addJson.ok).toBe(true);
    expect(addJson.cart.itemsCount).toBe(2);

    const updatedCookie = addRes.cookies.get(getCartCookieName("gamer"))!.value;
    expect(updatedCookie).not.toBe(cookie!.value); // Nonce frissült

    const getRes = await handleCartGet(
      makeRequest("/api/cart", {
        host: "gamer.localhost",
        cookies: { [getCartCookieName("gamer")]: updatedCookie },
      }),
      deps,
    );
    expect(getRes.status).toBe(200);
    expect((await getRes.json()).cart.itemsCount).toBe(2);

    const itemKey = addJson.cart.items[0].key as string;
    const patchRes = await handleCartUpdateItem(
      makeRequest("/api/cart/items", {
        method: "PATCH",
        host: "gamer.localhost",
        body: { key: itemKey, quantity: 3 },
        cookies: { [getCartCookieName("gamer")]: updatedCookie },
      }),
      deps,
    );
    const patchJson = await patchRes.json();
    expect(patchJson.cart.itemsCount).toBe(3);

    // Kupon alkalmazása és eltávolítása
    const couponRes = await handleCartApplyCoupon(
      makeRequest("/api/cart/coupons", {
        method: "POST",
        host: "gamer.localhost",
        body: { code: "GOBLIN10" },
        cookies: { [getCartCookieName("gamer")]: updatedCookie },
      }),
      deps,
    );
    const couponJson = await couponRes.json();
    expect(couponRes.status).toBe(200);
    expect(couponJson.cart.coupons).toHaveLength(1);

    const removeCouponRes = await handleCartRemoveCoupon(
      makeRequest("/api/cart/coupons", {
        method: "DELETE",
        host: "gamer.localhost",
        body: { code: "GOBLIN10" },
        cookies: { [getCartCookieName("gamer")]: updatedCookie },
      }),
      deps,
    );
    expect((await removeCouponRes.json()).cart.coupons).toHaveLength(0);

    // Szállítási cím + szállítási mód
    const addrRes = await handleCartUpdateShippingAddress(
      makeRequest("/api/cart/shipping", {
        method: "PATCH",
        host: "gamer.localhost",
        body: { country: "HU", postcode: "1053" },
        cookies: { [getCartCookieName("gamer")]: updatedCookie },
      }),
      deps,
    );
    expect((await addrRes.json()).cart.shippingAddress.postcode).toBe("1053");

    const shipRes = await handleCartSelectShipping(
      makeRequest("/api/cart/shipping", {
        method: "POST",
        host: "gamer.localhost",
        body: { packageId: 0, rateId: "local_pickup:2" },
        cookies: { [getCartCookieName("gamer")]: updatedCookie },
      }),
      deps,
    );
    const shipJson = await shipRes.json();
    expect(shipJson.cart.totals.shipping.amount).toBe("990");

    // Tétel törlése és kosár ürítése
    const delRes = await handleCartRemoveItem(
      makeRequest("/api/cart/items", {
        method: "DELETE",
        host: "gamer.localhost",
        body: { key: itemKey },
        cookies: { [getCartCookieName("gamer")]: updatedCookie },
      }),
      deps,
    );
    expect((await delRes.json()).cart.itemsCount).toBe(0);

    const clearRes = await handleCartClear(
      makeRequest("/api/cart", {
        method: "DELETE",
        host: "gamer.localhost",
        cookies: { [getCartCookieName("gamer")]: updatedCookie },
      }),
      deps,
    );
    expect((await clearRes.json()).cart.itemsCount).toBe(0);
  });

  it("Zod validáció hibás inputra 400 CART.INVALID_INPUT hibát ad", async () => {
    const deps: CartBffDeps = {
      getStoreClient: (brand) => createFixtureStoreClient({ brandId: brand.id }),
    };

    const badQty = await handleCartAddItem(
      makeRequest("/api/cart/items", {
        method: "POST",
        host: "gamer.localhost",
        body: { id: -5, quantity: 0 },
      }),
      deps,
    );
    expect(badQty.status).toBe(400);
    expect(await badQty.json()).toMatchObject({ ok: false, code: "CART.INVALID_INPUT" });

    const emptyCoupon = await handleCartApplyCoupon(
      makeRequest("/api/cart/coupons", {
        method: "POST",
        host: "gamer.localhost",
        body: { code: "   " },
      }),
      deps,
    );
    expect(emptyCoupon.status).toBe(400);
    expect(await emptyCoupon.json()).toMatchObject({ ok: false, code: "CART.INVALID_INPUT" });
  });

  it("csúszóablakos rate limit blokkolja a túlzott módosító kéréseket (429 CART.RATE_LIMITED)", async () => {
    let clock = 10_000;
    const deps: CartBffDeps = {
      getStoreClient: (brand) => createFixtureStoreClient({ brandId: brand.id }),
      now: () => clock,
      rateLimit: { maxRequests: 2, windowMs: 10_000 },
    };

    const pad = fixtureProducts.find((p) => p.slug.includes("titanweave"))!;
    const r1 = await handleCartAddItem(
      makeRequest("/api/cart/items", {
        method: "POST",
        host: "gamer.localhost",
        ip: "1.2.3.4",
        body: { id: pad.id, quantity: 1 },
      }),
      deps,
    );
    const r2 = await handleCartAddItem(
      makeRequest("/api/cart/items", {
        method: "POST",
        host: "gamer.localhost",
        ip: "1.2.3.4",
        body: { id: pad.id, quantity: 1 },
      }),
      deps,
    );
    const r3 = await handleCartAddItem(
      makeRequest("/api/cart/items", {
        method: "POST",
        host: "gamer.localhost",
        ip: "1.2.3.4",
        body: { id: pad.id, quantity: 1 },
      }),
      deps,
    );

    expect(r1.status).toBe(200);
    expect(r2.status).toBe(200);
    expect(r3.status).toBe(429);
    expect(r3.headers.get("retry-after")).toBeTruthy();
    expect(await r3.json()).toMatchObject({ ok: false, code: "CART.RATE_LIMITED" });

    // Ablak lejárta után újra engedi
    clock += 10_001;
    const r4 = await handleCartAddItem(
      makeRequest("/api/cart/items", {
        method: "POST",
        host: "gamer.localhost",
        ip: "1.2.3.4",
        body: { id: pad.id, quantity: 1 },
      }),
      deps,
    );
    expect(r4.status).toBe(200);
  });

  it("lejárt tokennél mutációkor új kosarat inicializál (401 CART.SESSION_INVALID), olvasó GET-nél viszont törli a cookie-t új Woo-session nyitása nélkül", async () => {
    const fixture = createFixtureStoreClient({ brandId: "gamer" });
    const getCartSpy = vi.fn(fixture.getCart);
    const expiredCookie = Buffer.from(
      JSON.stringify({ cartToken: "expired-token", nonce: "old-nonce" }),
      "utf8",
    ).toString("base64url");

    // 1. Olvasó GET lejárt cookie-val: 1 db getCart hívás elbukik, 200 üres kosár + törölt cookie (nincs 2. getCart!)
    const getExpiredRes = await handleCartGet(
      makeRequest("/api/cart", {
        host: "gamer.localhost",
        cookies: { [getCartCookieName("gamer")]: expiredCookie },
      }),
      {
        getStoreClient: () => ({ ...fixture, getCart: getCartSpy }),
      },
    );
    expect(getExpiredRes.status).toBe(200);
    expect((await getExpiredRes.json()).cart.itemsCount).toBe(0);
    expect(getCartSpy).toHaveBeenCalledTimes(1);
    expect(getExpiredRes.cookies.get(getCartCookieName("gamer"))?.maxAge).toBe(0);

    // 2. Mutáció lejárt cookie-val: új kosár inicializálva, 401 CART.SESSION_INVALID + új cookie
    const deps: CartBffDeps = {
      getStoreClient: () => ({
        ...fixture,
        addCartItem: async () => {
          throw new WooError("CART.SESSION_INVALID", "Token lejárt", { status: 401 });
        },
      }),
    };

    const res = await handleCartAddItem(
      makeRequest("/api/cart/items", {
        method: "POST",
        host: "gamer.localhost",
        body: { id: 10, quantity: 1 },
        cookies: { [getCartCookieName("gamer")]: expiredCookie },
      }),
      deps,
    );

    const json = await res.json();
    expect(res.status).toBe(401);
    expect(json).toMatchObject({ ok: false, code: "CART.SESSION_INVALID" });
    expect(json.cart).toBeDefined();
    expect(json.cart.itemsCount).toBe(0);

    const refreshedCookie = res.cookies.get(getCartCookieName("gamer"));
    expect(refreshedCookie?.value).toBeTruthy();
    expect(refreshedCookie?.value).not.toBe(expiredCookie);
  });

  it("brand-elkülönítés két hosttal: egyik brand cookie-ja és tokenje sem jut el másik brand Woo-jához", async () => {
    const receivedByBrand: {
      gamer: Array<CartSession | undefined>;
      masik: Array<CartSession | undefined>;
    } = {
      gamer: [],
      masik: [],
    };

    const makeSpyClient = (brandId: "gamer" | "masik"): StoreClient => {
      const base = createFixtureStoreClient({ brandId });
      return {
        ...base,
        getCart: vi.fn(async (session?: CartSession) => {
          receivedByBrand[brandId].push(session);
          return base.getCart(session);
        }),
      };
    };

    const clients: Record<string, StoreClient> = {
      gamer: makeSpyClient("gamer"),
      masik: makeSpyClient("masik"),
    };

    const deps: CartBffDeps = {
      resolveBrand: (req) => {
        const host = req.headers.get("host");
        if (host === "gamer.localhost") return gamerBrand;
        if (host === "masik.localhost") return secondBrand;
        return undefined;
      },
      getStoreClient: (brand) => clients[brand.id]!,
    };

    const pad = fixtureProducts.find((p) => p.slug.includes("titanweave"))!;

    // 1. Gamer host kosárba tesz -> kg_gamer_cart cookie
    const gamerRes = await handleCartAddItem(
      makeRequest("/api/cart/items", {
        method: "POST",
        host: "gamer.localhost",
        body: { id: pad.id, quantity: 1 },
      }),
      deps,
    );
    const gamerCookie = gamerRes.cookies.get("kg_gamer_cart")!.value;
    expect(gamerRes.cookies.get("kg_masik_cart")).toBeUndefined();

    // 2. Másik hostra elküldjük a gamer cookie-t is -> a masik Woo kliens NE kapja meg a gamer tokenjét!
    const masikRes = await handleCartAddItem(
      makeRequest("/api/cart/items", {
        method: "POST",
        host: "masik.localhost",
        body: { id: pad.id, quantity: 1 },
        cookies: { kg_gamer_cart: gamerCookie },
      }),
      deps,
    );
    expect(masikRes.status).toBe(200);
    expect(receivedByBrand.masik[0]).toBeUndefined();
    const masikCookie = masikRes.cookies.get("kg_masik_cart")!.value;
    expect(masikCookie).not.toBe(gamerCookie);
    expect(masikRes.cookies.get("kg_gamer_cart")).toBeUndefined();

    // 3. Mindkét cookie jelen van: mindkét host kizárólag a sajátját továbbítja a saját Woo-jának
    await handleCartGet(
      makeRequest("/api/cart", {
        host: "gamer.localhost",
        cookies: { kg_gamer_cart: gamerCookie, kg_masik_cart: masikCookie },
      }),
      deps,
    );
    await handleCartGet(
      makeRequest("/api/cart", {
        host: "masik.localhost",
        cookies: { kg_gamer_cart: gamerCookie, kg_masik_cart: masikCookie },
      }),
      deps,
    );

    expect(receivedByBrand.gamer[1]?.cartToken).toMatch(/^fixture-cart-gamer-/);
    expect(receivedByBrand.masik[1]?.cartToken).toMatch(/^fixture-cart-masik-/);
  });

  it("első mutáló kérés cookie nélkül inicializálja a kosár-sessiont; az ingyenes szállítás a brand küszöbét és a free_shipping metódust nézi", async () => {
    const base = createFixtureStoreClient({ brandId: "gamer" });
    const getCartSpy = vi.fn(base.getCart);
    const deps: CartBffDeps = {
      getStoreClient: () => ({ ...base, getCart: getCartSpy }),
    };

    const pad = fixtureProducts.find((p) => p.slug.includes("titanweave"))!;
    const addRes = await handleCartAddItem(
      makeRequest("/api/cart/items", {
        method: "POST",
        host: "gamer.localhost",
        body: { id: pad.id, quantity: 1 },
      }),
      deps,
    );
    expect(addRes.status).toBe(200);
    expect(getCartSpy).toHaveBeenCalledTimes(1);

    const cookie = addRes.cookies.get(getCartCookieName("gamer"))!.value;
    const foreignRes = await handleCartUpdateShippingAddress(
      makeRequest("/api/cart/shipping", {
        method: "PATCH",
        host: "gamer.localhost",
        body: { country: "SK", postcode: "81101" },
        cookies: { [getCartCookieName("gamer")]: cookie },
      }),
      deps,
    );
    const foreignJson = await foreignRes.json();
    expect(foreignRes.status).toBe(200);
    expect(foreignJson.cart.freeShippingProgress).toBeNull();

    // 0 Ft-os local_pickup nem számít free_shipping jogosultságnak
    const freePickupCart = structuredClone(fixtureCart);
    freePickupCart.items_count = 1;
    freePickupCart.totals.total_items = "8990";
    freePickupCart.totals.total_discount = "0";
    freePickupCart.shipping_rates = [
      {
        package_id: 0,
        name: "Szállítás",
        shipping_rates: [
          {
            rate_id: "local_pickup:1",
            name: "Személyes átvétel",
            description: "",
            delivery_time: "",
            price: "0",
            taxes: "0",
            method_id: "local_pickup",
            instance_id: 1,
            selected: true,
            currency_code: "HUF",
            currency_minor_unit: 0,
          },
        ],
      },
    ];
    const pickupRes = await handleCartAddItem(
      makeRequest("/api/cart/items", {
        method: "POST",
        host: "gamer.localhost",
        body: { id: pad.id, quantity: 1 },
      }),
      {
        getStoreClient: () => ({
          ...base,
          getCart: async () => ({ cart: freePickupCart, cartToken: "t1", nonce: "n1" }),
          addCartItem: async () => ({ cart: freePickupCart, cartToken: "t1", nonce: "n2" }),
        }),
      },
    );
    expect((await pickupRes.json()).cart.freeShippingProgress).toMatchObject({
      eligible: false,
      threshold: { amount: "25000", currency: "HUF", minorUnit: 0 },
      remaining: { amount: "16010", currency: "HUF", minorUnit: 0 },
    });

    // Küszöb nélküli brandre freeShippingProgress === null
    const noThresholdBrand: Brand = {
      ...structuredClone(secondBrand),
      merchandising: {
        rarityThresholds: secondBrand.merchandising.rarityThresholds,
      },
    };
    const noThresholdRes = await handleCartAddItem(
      makeRequest("/api/cart/items", {
        method: "POST",
        host: "masik.localhost",
        body: { id: pad.id, quantity: 1 },
      }),
      {
        resolveBrand: () => noThresholdBrand,
        getStoreClient: () => ({
          ...base,
          getCart: async () => ({ cart: freePickupCart, cartToken: "t2", nonce: "n1" }),
          addCartItem: async () => ({ cart: freePickupCart, cartToken: "t2", nonce: "n2" }),
        }),
      },
    );
    expect((await noThresholdRes.json()).cart.freeShippingProgress).toBeNull();
  });

  it("cookie nélküli GET nem hív Woo-t, nem nyit sessiont és nem ad cookie-t", async () => {
    const base = createFixtureStoreClient({ brandId: "gamer" });
    const getCartSpy = vi.fn(base.getCart);
    const rateLimiter = vi.fn(async () => ({ allowed: true as const }));
    const deps: CartBffDeps = {
      getStoreClient: () => ({ ...base, getCart: getCartSpy }),
      rateLimiter,
    };

    const res = await handleCartGet(makeRequest("/api/cart", { host: "gamer.localhost" }), deps);
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(res.headers.get("cache-control")).toBe("no-store");
    expect(json).toMatchObject({ ok: true, cart: { itemsCount: 0, items: [] } });
    expect(getCartSpy).not.toHaveBeenCalled();
    expect(rateLimiter).not.toHaveBeenCalled();
    expect(res.cookies.get(getCartCookieName("gamer"))).toBeUndefined();

    // Sérült (nem dekódolható base64/JSON) cookie esetén is Woo- és limiter-hívás nélkül tér vissza,
    // de aktívan törli (maxAge: 0) a hibás cookie-t.
    const corruptRes = await handleCartGet(
      makeRequest("/api/cart", {
        host: "gamer.localhost",
        cookies: { [getCartCookieName("gamer")]: "nem_ervenyes_base64_json" },
      }),
      deps,
    );
    expect(corruptRes.status).toBe(200);
    expect((await corruptRes.json()).cart.itemsCount).toBe(0);
    expect(getCartSpy).not.toHaveBeenCalled();
    expect(rateLimiter).not.toHaveBeenCalled();
    expect(corruptRes.cookies.get(getCartCookieName("gamer"))?.maxAge).toBe(0);
  });

  it("a cookie-s GET és a mutáció is a brand + cf-connecting-ip kulcson korlátozott", async () => {
    const keys: string[] = [];
    const deps: CartBffDeps = {
      getStoreClient: (brand) => createFixtureStoreClient({ brandId: brand.id }),
      rateLimiter: async (key) => {
        keys.push(key);
        return keys.length > 1 ? { allowed: false, retryAfterSeconds: 42 } : { allowed: true };
      },
    };
    const pad = fixtureProducts.find((p) => p.slug.includes("titanweave"))!;

    const addRes = await handleCartAddItem(
      makeRequest("/api/cart/items", {
        method: "POST",
        host: "gamer.localhost",
        ip: "203.0.113.7",
        body: { id: pad.id, quantity: 1 },
      }),
      deps,
    );
    expect(addRes.status).toBe(200);
    const cookie = addRes.cookies.get(getCartCookieName("gamer"))!.value;

    const getRes = await handleCartGet(
      makeRequest("/api/cart", {
        host: "gamer.localhost",
        ip: "203.0.113.7",
        cookies: { [getCartCookieName("gamer")]: cookie },
      }),
      deps,
    );
    expect(getRes.status).toBe(429);
    expect(getRes.headers.get("retry-after")).toBe("42");
    expect(await getRes.json()).toMatchObject({ ok: false, code: "CART.RATE_LIMITED" });
    expect(keys).toEqual(["gamer:203.0.113.7", "gamer:203.0.113.7"]);
  });

  it("Workersen a Rate Limiting bindingot használja, elutasításnál 429 és az ablaknyi Retry-After", async () => {
    const limit = vi.fn(async () => ({ success: false }));
    vi.mocked(getCloudflareContext).mockReturnValueOnce({
      env: { [CART_RATE_LIMIT_BINDING]: { limit } },
    } as unknown as ReturnType<typeof getCloudflareContext>);

    const res = await handleCartAddItem(
      makeRequest("/api/cart/items", {
        method: "POST",
        host: "gamer.localhost",
        ip: "198.51.100.1",
        body: { id: 10, quantity: 1 },
      }),
      { getStoreClient: (brand) => createFixtureStoreClient({ brandId: brand.id }) },
    );

    expect(limit).toHaveBeenCalledWith({ key: "gamer:198.51.100.1" });
    expect(res.status).toBe(429);
    expect(res.headers.get("retry-after")).toBe(String(CART_RATE_LIMIT_PERIOD_SECONDS));
  });

  it("fail-open: hiányzó binding vagy dobó limiter esetén naplóz és a memóriabeli tartalékra esik", async () => {
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => undefined);
    const deps: CartBffDeps = {
      getStoreClient: (brand) => createFixtureStoreClient({ brandId: brand.id }),
      rateLimit: { maxRequests: 1, windowMs: 60_000 },
    };
    const pad = fixtureProducts.find((p) => p.slug.includes("titanweave"))!;
    const add = () =>
      handleCartAddItem(
        makeRequest("/api/cart/items", {
          method: "POST",
          host: "gamer.localhost",
          ip: "192.0.2.10",
          body: { id: pad.id, quantity: 1 },
        }),
        deps,
      );

    // Van Cloudflare-kontextus, de nincs binding -> a tartalék korlátoz
    vi.mocked(getCloudflareContext).mockReturnValue({
      env: {},
    } as unknown as ReturnType<typeof getCloudflareContext>);
    expect((await add()).status).toBe(200);
    expect((await add()).status).toBe(429);
    expect(errorSpy).toHaveBeenCalledWith(
      "[bff-guard] Hiányzó rate limit binding, memóriabeli tartalék fut",
      expect.anything(),
    );

    // A binding kivételt dob -> nem 500, hanem a tartalék dönt
    resetCartRateLimiter();
    vi.mocked(getCloudflareContext).mockReturnValue({
      env: {
        [CART_RATE_LIMIT_BINDING]: {
          limit: async () => {
            throw new Error("binding hiba");
          },
        },
      },
    } as unknown as ReturnType<typeof getCloudflareContext>);
    expect((await add()).status).toBe(200);
    expect((await add()).status).toBe(429);
    expect(errorSpy).toHaveBeenCalledWith(
      "[bff-guard] Rate limiter hiba, memóriabeli tartalék fut",
    );
  });

  it("a 16 KiB feletti streamelt JSON-törzset azonnal megszakítja a teljes stream memóriába olvasása nélkül", async () => {
    let cancelled = false;
    let chunkIndex = 0;
    const totalChunks = 64; // 640 KiB lenne teljes olvasásnál
    const tenKbChunk = new Uint8Array(10 * 1024).fill(97);
    const stream = new ReadableStream<Uint8Array>({
      pull(controller) {
        chunkIndex += 1;
        if (chunkIndex <= totalChunks) {
          controller.enqueue(tenKbChunk);
          return;
        }
        controller.close();
      },
      cancel() {
        cancelled = true;
      },
    });

    const req = new NextRequest("http://gamer.localhost/api/cart/items", {
      method: "POST",
      headers: {
        host: "gamer.localhost",
        origin: "http://gamer.localhost",
        "content-type": "application/json",
      },
      body: stream,
      duplex: "half",
    });

    const res = await handleCartAddItem(req, {
      getStoreClient: (brand) => createFixtureStoreClient({ brandId: brand.id }),
    });

    expect(res.status).toBe(400);
    expect(await res.json()).toMatchObject({ ok: false, code: "CART.INVALID_INPUT" });
    expect(cancelled).toBe(true);
    expect(chunkIndex).toBeLessThanOrEqual(4);
  });

  it("a wrangler.jsonc deklarálja a rate limit bindingot a kódéval egyező ablakkal", () => {
    // A Vitest az apps/web gyökeréből fut (jsdom alatt az import.meta.url nem file: séma).
    const raw = readFileSync(join(process.cwd(), "wrangler.jsonc"), "utf8");
    const config = JSON.parse(raw.replace(/^\s*\/\/.*$/gm, "").replace(/,(\s*[}\]])/g, "$1")) as {
      ratelimits?: Array<{ name: string; simple: { limit: number; period: number } }>;
    };

    const binding = config.ratelimits?.find((r) => r.name === CART_RATE_LIMIT_BINDING);
    expect(binding).toBeDefined();
    expect(binding!.simple.period).toBe(CART_RATE_LIMIT_PERIOD_SECONDS);
  });

  it("helyi környezeten kívül az x-forwarded-for nem rate-limit kulcs (közös unknown vödör)", async () => {
    vi.stubEnv("NEXT_PUBLIC_APP_ENV", "demo");
    const deps: CartBffDeps = {
      getStoreClient: (brand) => createFixtureStoreClient({ brandId: brand.id }),
      rateLimit: { maxRequests: 1, windowMs: 60_000 },
    };
    const pad = fixtureProducts.find((p) => p.slug.includes("titanweave"))!;
    const add = (forwardedFor: string) =>
      handleCartAddItem(
        makeRequest("/api/cart/items", {
          method: "POST",
          host: "gamer.localhost",
          forwardedFor,
          body: { id: pad.id, quantity: 1 },
        }),
        deps,
      );

    expect((await add("1.1.1.1")).status).toBe(200);
    expect((await add("2.2.2.2")).status).toBe(429);

    vi.stubEnv("NEXT_PUBLIC_APP_ENV", "local");
    resetCartRateLimiter();
    expect((await add("1.1.1.1")).status).toBe(200);
    expect((await add("2.2.2.2")).status).toBe(200);
  });

  it("hiányzó vagy idegen Origin mutáló kérésen 400 CART.INVALID_INPUT, Woo-hívás nélkül", async () => {
    const base = createFixtureStoreClient({ brandId: "gamer" });
    const addSpy = vi.fn(base.addCartItem);
    const deps: CartBffDeps = { getStoreClient: () => ({ ...base, addCartItem: addSpy }) };
    const pad = fixtureProducts.find((p) => p.slug.includes("titanweave"))!;

    for (const origin of [null, "https://evil.example.test", "not a url"]) {
      const res = await handleCartAddItem(
        makeRequest("/api/cart/items", {
          method: "POST",
          host: "gamer.localhost",
          origin,
          body: { id: pad.id, quantity: 1 },
        }),
        deps,
      );
      expect(res.status).toBe(400);
      expect(await res.json()).toMatchObject({ ok: false, code: "CART.INVALID_INPUT" });
    }
    expect(addSpy).not.toHaveBeenCalled();
  });

  it("csak pontos application/json médiatípust fogad el (a charset paraméter megengedett)", async () => {
    const deps: CartBffDeps = {
      getStoreClient: (brand) => createFixtureStoreClient({ brandId: brand.id }),
    };
    const pad = fixtureProducts.find((p) => p.slug.includes("titanweave"))!;
    const add = (contentType: string) =>
      handleCartAddItem(
        makeRequest("/api/cart/items", {
          method: "POST",
          host: "gamer.localhost",
          contentType,
          body: { id: pad.id, quantity: 1 },
        }),
        deps,
      );

    expect((await add("text/plain; application/json")).status).toBe(400);
    expect((await add("application/jsonp")).status).toBe(400);
    expect((await add("application/json; charset=utf-8")).status).toBe(200);
  });

  it("nem session-jellegű upstream 401/403 (pl. WAF) nem törli és nem cseréli a kosár-cookie-t", async () => {
    const fixture = createFixtureStoreClient({ brandId: "gamer" });
    const getCartSpy = vi.fn(fixture.getCart);
    const deps: CartBffDeps = {
      getStoreClient: () => ({
        ...fixture,
        getCart: getCartSpy,
        removeCartItem: async () => {
          throw new WooError("WOO.UNAVAILABLE", "WAF-blokk", { status: 403 });
        },
      }),
    };
    const cookieValue = Buffer.from(
      JSON.stringify({ cartToken: "tok-1", nonce: "n-1" }),
      "utf8",
    ).toString("base64url");

    const res = await handleCartRemoveItem(
      makeRequest("/api/cart/items", {
        method: "DELETE",
        host: "gamer.localhost",
        body: { key: "line-1" },
        cookies: { [getCartCookieName("gamer")]: cookieValue },
      }),
      deps,
    );
    const json = await res.json();

    expect(res.status).toBe(503);
    expect(json).toMatchObject({ ok: false, code: "WOO.UNAVAILABLE" });
    expect(json.cart).toBeUndefined();
    expect(res.cookies.get(getCartCookieName("gamer"))).toBeUndefined();
    expect(getCartSpy).not.toHaveBeenCalled();
  });
});
