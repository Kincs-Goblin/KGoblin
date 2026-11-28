import "server-only";

import type { Brand } from "@kg/brand-config";
import { createWooClient, type StoreClient } from "@kg/woo-client";

import { serverEnv } from "../config/env";

function createLazyFixtureStoreClient(brandId: string): StoreClient {
  let clientPromise: Promise<StoreClient> | undefined;
  const getClient = () => {
    clientPromise ??= import("@kg/woo-client/fixtures").then((mod) =>
      mod.createFixtureStoreClient({ brandId }),
    );
    return clientPromise;
  };

  return {
    getProducts: async (query, cache) => (await getClient()).getProducts(query, cache),
    getProductsPage: async (query, cache) => (await getClient()).getProductsPage(query, cache),
    getProductById: async (id, cache) => (await getClient()).getProductById(id, cache),
    getProductBySlug: async (slug, cache) => (await getClient()).getProductBySlug(slug, cache),
    resolveSlugRedirect: async (type, slug, cache) =>
      (await getClient()).resolveSlugRedirect(type, slug, cache),
    getCategories: async (cache) => (await getClient()).getCategories(cache),
    getAttributes: async (cache) => (await getClient()).getAttributes(cache),
    getAttributeTerms: async (attributeId, cache) =>
      (await getClient()).getAttributeTerms(attributeId, cache),
    getCart: async (session) => (await getClient()).getCart(session),
    addCartItem: async (input, session) => (await getClient()).addCartItem(input, session),
    updateCartItem: async (input, session) => (await getClient()).updateCartItem(input, session),
    removeCartItem: async (input, session) => (await getClient()).removeCartItem(input, session),
    clearCart: async (session) => (await getClient()).clearCart(session),
    applyCoupon: async (input, session) => (await getClient()).applyCoupon(input, session),
    removeCoupon: async (input, session) => (await getClient()).removeCoupon(input, session),
    selectShippingRate: async (input, session) =>
      (await getClient()).selectShippingRate(input, session),
    updateCustomer: async (input, session) => (await getClient()).updateCustomer(input, session),
    getCheckout: async (session) => (await getClient()).getCheckout(session),
    submitCheckout: async (input, session) => (await getClient()).submitCheckout(input, session),
  };
}

/**
 * A brand Store API-kliense. Fixture csak nem-production környezetben és kifejezett
 * `KG_STORE_FIXTURES=1` mellett töltődik be dinamikusan (így az éles bundle-be nem kerül be);
 * egyébként `createWooClient(brand)` oldja fel a brandhez tartozó Woo-címet (hiányzónál `WOO.UNAVAILABLE`).
 */
export function getStoreClient(brand: Brand): StoreClient {
  if (process.env.NEXT_PUBLIC_APP_ENV !== "production" && serverEnv.KG_STORE_FIXTURES === "1") {
    return createLazyFixtureStoreClient(brand.id);
  }
  return createWooClient(brand);
}
