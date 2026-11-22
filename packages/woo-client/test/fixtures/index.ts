import { WooError } from "../../src/errors";
import type { ProductPageResult, ProductQuery, StoreClient } from "../../src/store/client";
import {
  attributeListSchema,
  attributeTermListSchema,
  cartSchema,
  categoryListSchema,
  productListSchema,
  type StoreAttributeTerm,
  type StoreProduct,
} from "../../src/store/schemas";
import attributeTermsJson from "./attribute-terms.json";
import attributesJson from "./attributes.json";
import cartJson from "./cart.json";
import categoriesJson from "./categories.json";
import productsJson from "./products.json";

/**
 * Valódi Store API-válaszok a KG-9 lokális Woo-ból (gamer seed, személyes adat nélkül), 2026-11-16.
 * Ugyanazon a Zod-sémán mennek át, mint az élő válasz.
 */
export const fixtureProducts = productListSchema.parse(productsJson);
export const fixtureCategories = categoryListSchema.parse(categoriesJson);
export const fixtureAttributes = attributeListSchema.parse(attributesJson);
export const fixtureAttributeTerms: Record<string, StoreAttributeTerm[]> = Object.fromEntries(
  Object.entries(attributeTermsJson).map(([attrId, terms]) => [
    attrId,
    attributeTermListSchema.parse(terms),
  ]),
);
export const fixtureCart = cartSchema.parse(cartJson);

/** Fixture módú `_wp_old_slug` példa a 301 átirányítás e2e és unit teszteléséhez. */
export const fixtureProductSlugRedirects: Record<string, string> = {
  "runakard-tkl-regi": "runakard-tkl-pro-vezetek-nelkuli-billentyuzet",
};

export function filterAndPaginateFixtureProducts(
  source: readonly StoreProduct[],
  query: ProductQuery = {},
): ProductPageResult {
  let products = [...source];

  if (query.category) {
    products = products.filter((p) =>
      p.categories.some((c) => String(c.id) === query.category || c.slug === query.category),
    );
  }
  if (query.featured) {
    products = products.filter((p) => p.tags.some((t) => t.slug === "kiemelt"));
  }
  if (query.tag) {
    products = products.filter((p) =>
      p.tags.some((t) => String(t.id) === query.tag || t.slug === query.tag),
    );
  }
  if (query.onSale) {
    products = products.filter((p) => p.on_sale);
  }
  if (query.minPrice !== undefined) {
    products = products.filter((p) => Number(p.prices.price) >= query.minPrice!);
  }
  if (query.maxPrice !== undefined) {
    products = products.filter((p) => Number(p.prices.price) <= query.maxPrice!);
  }
  if (query.stockStatus !== undefined) {
    const statuses = Array.isArray(query.stockStatus) ? query.stockStatus : [query.stockStatus];
    products = products.filter((p) =>
      statuses.some((status) => {
        if (status === "onbackorder") return p.is_on_backorder;
        if (status === "outofstock") return !p.is_in_stock;
        return p.is_in_stock && !p.is_on_backorder;
      }),
    );
  }
  if (query.attributes?.length) {
    products = products.filter((p) =>
      query.attributes!.every((filter) =>
        p.attributes.some(
          (attr) =>
            attr.taxonomy === filter.attribute &&
            attr.terms.some((term) => term.slug === filter.slug),
        ),
      ),
    );
  }
  if (query.search) {
    const needle = query.search.toLowerCase();
    products = products.filter(
      (p) =>
        p.name.toLowerCase().includes(needle) ||
        p.short_description.toLowerCase().includes(needle) ||
        p.sku.toLowerCase().includes(needle),
    );
  }

  const direction = query.order === "desc" ? -1 : 1;
  if (query.orderby === "price") {
    products.sort((a, b) => (Number(a.prices.price) - Number(b.prices.price)) * direction);
  } else if (query.orderby === "title") {
    products.sort((a, b) => a.name.localeCompare(b.name, "hu") * direction);
  } else if (query.orderby === "popularity") {
    products.sort((a, b) => {
      const featA = a.tags.some((t) => t.slug === "kiemelt") ? 1 : 0;
      const featB = b.tags.some((t) => t.slug === "kiemelt") ? 1 : 0;
      if (featA !== featB) return (featA - featB) * direction;
      return (a.id - b.id) * direction;
    });
  } else if (query.orderby === "date" && query.order === "asc") {
    products.reverse();
  }

  const perPage = Math.max(1, query.perPage ?? 24);
  const page = Math.max(1, query.page ?? 1);
  const total = products.length;
  const totalPages = Math.max(1, Math.ceil(total / perPage));
  const offset = (page - 1) * perPage;

  return {
    products: products.slice(offset, offset + perPage),
    total,
    totalPages,
  };
}

/** Woo nélküli futáshoz (CI e2e, lokális fejlesztés Docker nélkül). */
export function createFixtureStoreClient(): StoreClient {
  const unsupported = (method: string): never => {
    throw new WooError("WOO.UNAVAILABLE", `Fixture módban nem támogatott művelet: ${method}`);
  };

  return {
    async getProducts(query = {}) {
      return filterAndPaginateFixtureProducts(fixtureProducts, query).products;
    },
    async getProductsPage(query = {}) {
      return filterAndPaginateFixtureProducts(fixtureProducts, query);
    },
    async getProductById(id) {
      return fixtureProducts.find((p) => p.id === id) ?? null;
    },
    async getProductBySlug(slug) {
      return fixtureProducts.find((p) => p.slug === slug) ?? null;
    },
    async resolveSlugRedirect(type, slug) {
      if (type !== "product") return null;
      return fixtureProductSlugRedirects[slug] ?? null;
    },
    async getCategories() {
      return fixtureCategories;
    },
    async getAttributes() {
      return fixtureAttributes;
    },
    async getAttributeTerms(attributeId) {
      return fixtureAttributeTerms[String(attributeId)] ?? [];
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
