import { WooError } from "../../src/errors";
import type { StoreClient } from "../../src/store/client";
import {
  attributeListSchema,
  cartSchema,
  categoryListSchema,
  productListSchema,
} from "../../src/store/schemas";
import attributesJson from "./attributes.json";
import cartJson from "./cart.json";
import categoriesJson from "./categories.json";
import productsJson from "./products.json";

/**
 * Valódi Store API-válaszok a KG-4 lokális Woo-ból (gamer seed, személyes adat nélkül), 2026-11-12.
 * Ugyanazon a Zod-sémán mennek át, mint az élő válasz.
 */
export const fixtureProducts = productListSchema.parse(productsJson);
export const fixtureCategories = categoryListSchema.parse(categoriesJson);
export const fixtureAttributes = attributeListSchema.parse(attributesJson);
export const fixtureCart = cartSchema.parse(cartJson);

/** Woo nélküli futáshoz (CI e2e, lokális fejlesztés Docker nélkül). */
export function createFixtureStoreClient(): StoreClient {
  const unsupported = (method: string): never => {
    throw new WooError("WOO.UNAVAILABLE", `Fixture módban nem támogatott művelet: ${method}`);
  };

  return {
    async getProducts(query = {}) {
      let products = fixtureProducts;
      if (query.category) {
        products = products.filter((p) =>
          p.categories.some((c) => String(c.id) === query.category),
        );
      }
      if (query.onSale) products = products.filter((p) => p.on_sale);
      if (query.search) {
        const needle = query.search.toLowerCase();
        products = products.filter((p) => p.name.toLowerCase().includes(needle));
      }
      return products.slice(0, query.perPage ?? 24);
    },
    async getProductById(id) {
      return fixtureProducts.find((p) => p.id === id) ?? null;
    },
    async getProductBySlug(slug) {
      return fixtureProducts.find((p) => p.slug === slug) ?? null;
    },
    async getCategories() {
      return fixtureCategories;
    },
    async getAttributes() {
      return fixtureAttributes;
    },
    async getAttributeTerms() {
      return [];
    },
    async getCart(session) {
      return {
        cart: fixtureCart,
        cartToken: session?.cartToken ?? "fixture-cart-token",
        nonce: session?.nonce ?? "fixture-nonce",
      };
    },
    async addCartItem() {
      return unsupported("addCartItem");
    },
    async updateCartItem() {
      return unsupported("updateCartItem");
    },
    async removeCartItem() {
      return unsupported("removeCartItem");
    },
    async applyCoupon() {
      return unsupported("applyCoupon");
    },
    async removeCoupon() {
      return unsupported("removeCoupon");
    },
    async selectShippingRate() {
      return unsupported("selectShippingRate");
    },
    async getCheckout() {
      return unsupported("getCheckout");
    },
    async submitCheckout() {
      return unsupported("submitCheckout");
    },
  };
}
