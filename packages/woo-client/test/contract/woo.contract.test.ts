import { describe, expect, it } from "vitest";

import { createRestClient } from "../../src/rest/client";
import { createStoreClient } from "../../src/store/client";

/**
 * Contract-teszt a futó lokális Docker-Woo ellen (`pnpm --filter @kg/woo-client test:contract`).
 * CI-ban alapból nem fut; sémaváltozáskor vagy lokális Woo-ellenőrzéskor kötelező.
 */
const baseUrl =
  process.env.WOO_CONTRACT_BASE_URL ?? process.env.WOO_GAMER_URL ?? "http://localhost:8080";
const consumerKey = process.env.WOO_GAMER_CONSUMER_KEY;
const consumerSecret = process.env.WOO_GAMER_CONSUMER_SECRET;

describe("WooCommerce lokális Docker contract-teszt", () => {
  it("Store API: products, categories, attributes, cart és add-item megfelel a Zod sémáknak", async () => {
    const client = createStoreClient({ baseUrl });

    const page = await client.getProductsPage({ perPage: 20 });
    expect(page.products.length).toBeGreaterThan(0);
    expect(page.total).toBeGreaterThanOrEqual(page.products.length);

    const first =
      page.products.find((p) => p.type === "simple" && p.is_in_stock) ?? page.products[0]!;
    const saleSimple = page.products.find((p) => p.type === "simple" && p.on_sale);
    const variableProduct = page.products.find((p) => p.type === "variable");

    expect(first.extensions.kg_headless).toBeDefined();
    expect(typeof first.extensions.kg_headless?.delivery_time).toBe("string");
    if (saleSimple) {
      expect(saleSimple.extensions.kg_headless?.lowest_price_30_days).toEqual(expect.any(Number));
    }
    expect(variableProduct).toBeDefined();
    const variations = variableProduct?.extensions.kg_headless?.variations ?? [];
    expect(variations.length).toBeGreaterThan(0);
    expect(variations[0]?.attributes.length).toBeGreaterThan(0);
    expect(Number(variations[0]?.prices.price)).toBeGreaterThan(0);
    expect(variations[0]?.lowest_price_30_days).toEqual(expect.any(Number));
    expect(
      variations.some((v) => typeof v.delivery_time === "string" && v.delivery_time.length > 0),
    ).toBe(true);

    const [bySlug, byId, categories, attributes, initialCart] = await Promise.all([
      client.getProductBySlug(first.slug),
      client.getProductById(first.id),
      client.getCategories(),
      client.getAttributes(),
      client.getCart(),
    ]);
    expect(bySlug?.id).toBe(first.id);
    expect(byId?.slug).toBe(first.slug);
    expect(Array.isArray(categories)).toBe(true);
    expect(Array.isArray(attributes)).toBe(true);
    expect(initialCart.cartToken).toBeTruthy();

    if (attributes[0]) {
      const terms = await client.getAttributeTerms(attributes[0].id);
      expect(Array.isArray(terms)).toBe(true);
    }

    const added = await client.addCartItem(
      { id: first.id, quantity: 1 },
      { cartToken: initialCart.cartToken, nonce: initialCart.nonce },
    );
    expect(added.cart.items_count).toBeGreaterThanOrEqual(1);

    const itemKey = added.cart.items[0]?.key;
    if (itemKey) {
      const removed = await client.removeCartItem(
        { key: itemKey },
        { cartToken: added.cartToken, nonce: added.nonce },
      );
      expect(removed.cart.items_count).toBe(0);
    }
  });

  it.skipIf(!consumerKey || !consumerSecret)(
    "REST v3: products lista megfelel a Zod sémának (ha WOO_GAMER_CONSUMER_* megadva)",
    async () => {
      const rest = createRestClient({
        baseUrl,
        consumerKey: consumerKey!,
        consumerSecret: consumerSecret!,
      });
      const products = await rest.listProducts({ perPage: 5 });
      expect(products.length).toBeGreaterThan(0);
    },
  );
});
