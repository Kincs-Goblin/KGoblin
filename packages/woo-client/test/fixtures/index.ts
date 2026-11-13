import type { StoreClient } from "../../src/store/client";
import { categoryListSchema, productListSchema } from "../../src/store/schemas";
import categoriesJson from "./categories.json";
import productsJson from "./products.json";

/**
 * Valódi Store API-válaszok a KG-4 lokális Woo-ból (gamer seed, személyes adat nélkül), 2026-11-12.
 * Ugyanazon a Zod-sémán mennek át, mint az élő válasz.
 */
export const fixtureProducts = productListSchema.parse(productsJson);
export const fixtureCategories = categoryListSchema.parse(categoriesJson);

/** Woo nélküli futáshoz (CI e2e, lokális fejlesztés Docker nélkül). */
export function createFixtureStoreClient(): StoreClient {
  return {
    async getProducts(query = {}) {
      let products = fixtureProducts;
      if (query.category) {
        products = products.filter((p) =>
          p.categories.some((c) => String(c.id) === query.category),
        );
      }
      if (query.onSale) products = products.filter((p) => p.on_sale);
      return products.slice(0, query.perPage ?? 24);
    },
    async getProductBySlug(slug) {
      return fixtureProducts.find((p) => p.slug === slug) ?? null;
    },
    async getCategories() {
      return fixtureCategories;
    },
  };
}
