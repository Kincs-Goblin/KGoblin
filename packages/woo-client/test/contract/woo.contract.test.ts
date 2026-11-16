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

    const products = await client.getProducts({ perPage: 20 });
    expect(products.length).toBeGreaterThan(0);

    const first = products[0]!;
    const bySlug = await client.getProductBySlug(first.slug);
    expect(bySlug?.id).toBe(first.id);

    const byId = await client.getProductById(first.id);
    expect(byId?.slug).toBe(first.slug);

    const categories = await client.getCategories();
    expect(Array.isArray(categories)).toBe(true);

    const attributes = await client.getAttributes();
    expect(Array.isArray(attributes)).toBe(true);

    const initialCart = await client.getCart();
    expect(initialCart.cartToken).toBeTruthy();

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
