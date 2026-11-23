import { getBrandById, type Brand } from "@kg/brand-config";
import { WooError, type CartSession, type StoreClient } from "@kg/woo-client";
import {
  createFixtureStoreClient,
  fixtureProducts,
  resetFixtureCartSessions,
} from "@kg/woo-client/fixtures";
import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

import {
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

const gamerBrand = getBrandById("gamer")!;
const secondBrand: Brand = {
  ...structuredClone(gamerBrand),
  id: "masik",
  name: "Másik Shop",
  domains: ["masik.localhost"],
  woo: { baseUrlEnv: "WOO_MASIK_URL" },
};

function makeRequest(
  path: string,
  options?: {
    method?: string;
    host?: string;
    body?: unknown;
    cookies?: Record<string, string>;
    ip?: string;
  },
): NextRequest {
  const headers = new Headers();
  if (options?.host) headers.set("host", options.host);
  if (options?.ip) headers.set("x-forwarded-for", options.ip);
  if (options?.cookies) {
    headers.set(
      "cookie",
      Object.entries(options.cookies)
        .map(([k, v]) => `${k}=${v}`)
        .join("; "),
    );
  }
  if (options?.body !== undefined) {
    headers.set("content-type", "application/json");
  }
  return new NextRequest(`http://${options?.host ?? "gamer.localhost"}${path}`, {
    method: options?.method ?? "GET",
    headers,
    ...(options?.body !== undefined ? { body: JSON.stringify(options.body) } : {}),
  });
}

describe("Cart BFF route handlerek", () => {
  beforeEach(() => {
    resetCartRateLimiter();
    resetFixtureCartSessions();
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

    const getRes = await handleCartGet(makeRequest("/api/cart", { host: "gamer.localhost" }), deps);
    expect(getRes.status).toBe(200);
    expect(getRes.headers.get("cache-control")).toBe("no-store");

    const cookie = getRes.cookies.get(getCartCookieName("gamer"));
    expect(cookie).toBeDefined();
    expect(cookie?.httpOnly).toBe(true);
    expect(cookie?.sameSite).toBe("lax");
    expect(cookie?.secure).toBe(true);

    const pad = fixtureProducts.find((p) => p.slug.includes("titanweave"))!;
    const addRes = await handleCartAddItem(
      makeRequest("/api/cart/items", {
        method: "POST",
        host: "gamer.localhost",
        body: { id: pad.id, quantity: 2 },
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

  it("lejárt/érvénytelen tokennél új kosarat inicializál, frissíti a cookie-t és CART.SESSION_INVALID választ ad", async () => {
    const fixture = createFixtureStoreClient({ brandId: "gamer" });
    const expiredCookie = Buffer.from(
      JSON.stringify({ cartToken: "expired-token", nonce: "old-nonce" }),
      "utf8",
    ).toString("base64url");

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

    // 1. Gamer host lekéri a saját kosarát -> kg_gamer_cart cookie
    const gamerRes = await handleCartGet(
      makeRequest("/api/cart", { host: "gamer.localhost" }),
      deps,
    );
    const gamerCookie = gamerRes.cookies.get("kg_gamer_cart")!.value;
    expect(gamerRes.cookies.get("kg_masik_cart")).toBeUndefined();

    // 2. Másik hostra elküldjük a gamer cookie-t is -> a masik Woo kliens NE kapja meg a gamer tokenjét!
    const masikRes = await handleCartGet(
      makeRequest("/api/cart", {
        host: "masik.localhost",
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

  it("első mutáló kérés cookie nélkül automatikusan inicializálja a kosár-sessiont, és külföldi országra nincs ingyenes szállítási sáv", async () => {
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
  });
});
