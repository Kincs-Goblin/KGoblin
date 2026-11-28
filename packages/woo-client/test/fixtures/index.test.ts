import { describe, expect, it, beforeEach } from "vitest";

import { createFixtureStoreClient, fixtureProducts, resetFixtureCartSessions } from "./index";

describe("createFixtureStoreClient kosár-életciklus", () => {
  beforeEach(() => {
    resetFixtureCartSessions();
  });

  it("üres kosárral indul, kezeli a variációt, kupont, szállítást és ürítést", async () => {
    const client = createFixtureStoreClient({ brandId: "gamer" });

    const initial = await client.getCart();
    expect(initial.cart.items).toEqual([]);
    expect(initial.cart.items_count).toBe(0);
    expect(initial.cartToken).toMatch(/^fixture-cart-gamer-/);
    expect(initial.nonce).toBe("fixture-nonce-1");

    // Egyszerű termék (olcsóbb mint 25 000 Ft: TitanWeave egérpad 8 990 Ft)
    const pad = fixtureProducts.find((p) => p.slug.includes("titanweave"))!;
    const added = await client.addCartItem(
      { id: pad.id, quantity: 1 },
      { cartToken: initial.cartToken, nonce: initial.nonce },
    );
    expect(added.cart.items_count).toBe(1);
    expect(added.cart.totals.total_items).toBe(pad.prices.price);
    expect(added.nonce).toBe("fixture-nonce-2");

    // 25 000 Ft alatt még nincs ingyenes szállítás
    const ratesBefore = added.cart.shipping_rates[0]?.shipping_rates ?? [];
    expect(ratesBefore.some((r) => r.method_id === "free_shipping")).toBe(false);

    // Variáció hozzáadása (RunaKard) -> 25 000 Ft fölé lép -> ingyenes szállítás elérhető
    const variable = fixtureProducts.find((p) => p.type === "variable")!;
    const variation = variable.extensions.kg_headless!.variations!.find((v) => v.is_in_stock)!;
    const withVar = await client.addCartItem(
      { id: variation.id, quantity: 1 },
      { cartToken: added.cartToken, nonce: added.nonce },
    );
    expect(withVar.cart.items_count).toBe(2);
    expect(withVar.cart.items.find((i) => i.id === variation.id)?.variation.length).toBeGreaterThan(
      0,
    );
    const ratesAfter = withVar.cart.shipping_rates[0]?.shipping_rates ?? [];
    expect(ratesAfter.some((r) => r.method_id === "free_shipping")).toBe(true);

    // Kupon: érvénytelen -> CART.COUPON_INVALID, GOBLIN10 -> 10% kedvezmény
    await expect(
      client.applyCoupon({ code: "NOPE" }, { cartToken: withVar.cartToken, nonce: withVar.nonce }),
    ).rejects.toMatchObject({ code: "CART.COUPON_INVALID" });

    const discounted = await client.applyCoupon(
      { code: "GOBLIN10" },
      { cartToken: withVar.cartToken, nonce: withVar.nonce },
    );
    expect(discounted.cart.coupons).toHaveLength(1);
    expect(Number(discounted.cart.totals.total_discount)).toBeGreaterThan(0);

    // Szállítási cím és szállítási mód
    const addrUpdated = await client.updateCustomer(
      { shipping_address: { country: "HU", postcode: "1053" } },
      { cartToken: discounted.cartToken, nonce: discounted.nonce },
    );
    expect(addrUpdated.cart.shipping_address?.postcode).toBe("1053");

    const selected = await client.selectShippingRate(
      { rateId: "free_shipping:3" },
      { cartToken: addrUpdated.cartToken, nonce: addrUpdated.nonce },
    );
    expect(selected.cart.totals.total_shipping).toBe("0");

    // Ürítés
    const cleared = await client.clearCart({
      cartToken: selected.cartToken,
      nonce: selected.nonce,
    });
    expect(cleared.cart.items).toEqual([]);
    expect(cleared.cart.coupons).toEqual([]);
    expect(cleared.cart.totals.total_price).toBe("0");
  });

  it("lejárt tokenre és idegen brand tokenjére CART.SESSION_INVALID hibát dob", async () => {
    const gamerClient = createFixtureStoreClient({ brandId: "gamer" });
    const otherClient = createFixtureStoreClient({ brandId: "masik" });

    await expect(gamerClient.getCart({ cartToken: "expired" })).rejects.toMatchObject({
      code: "CART.SESSION_INVALID",
    });

    const gamerCart = await gamerClient.getCart();
    await expect(otherClient.getCart({ cartToken: gamerCart.cartToken })).rejects.toMatchObject({
      code: "CART.SESSION_INVALID",
    });
  });

  it("ismeretlen tokenre (pl. másik izolátum) CART.SESSION_INVALID, és nem veszi át a tokent új kosárnak", async () => {
    const client = createFixtureStoreClient({ brandId: "gamer" });

    await expect(client.getCart({ cartToken: "fixture-cart-gamer-999" })).rejects.toMatchObject({
      code: "CART.SESSION_INVALID",
      wooCode: "woocommerce_rest_cart_token_invalid",
    });

    const fresh = await client.getCart();
    expect(fresh.cartToken).not.toBe("fixture-cart-gamer-999");
  });

  it("izolátumváltáskor (resetFixtureCartSessions után) az érvényes snapshot-tokenből visszaállítja a kosár állapotát", async () => {
    const client = createFixtureStoreClient({ brandId: "gamer" });
    const pad = fixtureProducts.find((p) => p.slug.includes("titanweave"))!;

    const added = await client.addCartItem({ id: pad.id, quantity: 2 });
    const couponed = await client.applyCoupon(
      { code: "GOBLIN10" },
      { cartToken: added.cartToken, nonce: added.nonce },
    );
    const addressed = await client.updateCustomer(
      { shipping_address: { country: "HU", postcode: "1053", city: "Budapest" } },
      { cartToken: couponed.cartToken, nonce: couponed.nonce },
    );
    const shipped = await client.selectShippingRate(
      { rateId: "local_pickup:2" },
      { cartToken: addressed.cartToken, nonce: addressed.nonce },
    );

    resetFixtureCartSessions();

    const restored = await client.getCart({
      cartToken: shipped.cartToken,
      nonce: shipped.nonce,
    });
    expect(restored.cart.items_count).toBe(2);
    expect(restored.cart.coupons[0]?.code).toBe("goblin10");
    expect(restored.cart.shipping_address?.postcode).toBe("1053");
    expect(
      restored.cart.shipping_rates[0]?.shipping_rates.find((r) => r.rate_id === "local_pickup:2")
        ?.selected,
    ).toBe(true);
  });

  it("meleg izolátumra visszatérve a frissebb cookie-snapshot felülírja az elavult memóriabeli állapotot, és a sessionId nem szekvenciális", async () => {
    const client = createFixtureStoreClient({ brandId: "retro-gamer" });
    const pad = fixtureProducts.find((p) => p.slug.includes("titanweave"))!;

    // 1. izolátum: 1 db termék bekerül (nonce = 2), véletlen hex sessionId-val
    const step1 = await client.addCartItem({ id: pad.id, quantity: 1 });
    expect(step1.cartToken).toMatch(/^fixture-cart-retro-gamer-[a-f0-9]{32}\./);

    // 2. izolátum (reset után): ugyanahhoz a kosárhoz még 2 db-ot adunk (összesen 3 db, nonce = 3)
    resetFixtureCartSessions();
    const step2 = await client.addCartItem(
      { id: pad.id, quantity: 2 },
      { cartToken: step1.cartToken, nonce: step1.nonce },
    );
    expect(step2.cart.items_count).toBe(3);

    // Visszaállítjuk az 1. izolátum elavult (nonce = 2, 1 db) memóriabeli állapotát...
    resetFixtureCartSessions();
    const staleWarm = await client.getCart({ cartToken: step1.cartToken, nonce: step1.nonce });
    expect(staleWarm.cart.items_count).toBe(1);

    // ...majd reset NÉLKÜL beérkezik a 2. izolátumról származó frissebb (nonce = 3) cookie:
    const converged = await client.getCart({ cartToken: step2.cartToken, nonce: step2.nonce });
    expect(converged.cart.items_count).toBe(3);
  });

  it("különböző variációs attribútum-választások azonos termék/variáció ID mellett külön kosársort kapnak", async () => {
    const client = createFixtureStoreClient({ brandId: "gamer" });
    const variable = fixtureProducts.find((p) => p.type === "variable")!;

    const first = await client.addCartItem({
      id: variable.id,
      quantity: 1,
      variation: [{ attribute: "pa_kapcsolo", value: "linearis-red" }],
    });
    const second = await client.addCartItem(
      {
        id: variable.id,
        quantity: 1,
        variation: [{ attribute: "pa_kapcsolo", value: "taktilis-brown" }],
      },
      { cartToken: first.cartToken, nonce: first.nonce },
    );

    expect(second.cart.items).toHaveLength(2);
    expect(second.cart.items[0]?.key).not.toBe(second.cart.items[1]?.key);

    resetFixtureCartSessions();
    const restored = await client.getCart({ cartToken: second.cartToken, nonce: second.nonce });
    expect(restored.cart.items).toHaveLength(2);
    expect(restored.cart.items[0]?.key).not.toBe(restored.cart.items[1]?.key);
  });
});
