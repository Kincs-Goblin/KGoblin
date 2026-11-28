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
});
