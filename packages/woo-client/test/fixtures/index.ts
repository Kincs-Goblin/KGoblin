import { z } from "zod";

import { WooError } from "../../src/errors";
import type {
  CartSession,
  ProductPageResult,
  ProductQuery,
  StoreCartResult,
  StoreClient,
} from "../../src/store/client";
import {
  attributeListSchema,
  attributeTermListSchema,
  cartSchema,
  categoryListSchema,
  productListSchema,
  type StoreAddress,
  type StoreAttributeTerm,
  type StoreCart,
  type StoreCartCoupon,
  type StoreCartItem,
  type StoreProduct,
  type StoreShippingRate,
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

/** Fixture kuponok és ingyenes szállítási küszöb (minor unit, HUF = Ft). */
export const FIXTURE_FREE_SHIPPING_THRESHOLD = 25_000;
const FIXTURE_COUPONS: Record<string, { code: string; percent: number }> = {
  GOBLIN10: { code: "goblin10", percent: 10 },
};

const MAX_FIXTURE_QUANTITY = 30;
const MAX_FIXTURE_SESSIONS = 500;
const FIXTURE_TOKEN_PREFIX = "fixture-cart-";

type FixtureSessionLine = {
  key: string;
  id: number;
  quantity: number;
  variation: Array<{ attribute: string; value: string }>;
};

type FixtureCartSessionState = {
  brandId: string;
  sessionId: string;
  cartToken: string;
  nonceCounter: number;
  items: FixtureSessionLine[];
  coupons: string[];
  selectedRateId: string;
  shippingAddress: StoreAddress;
  billingAddress: StoreAddress;
};

const fixtureTokenSnapshotSchema = z.object({
  n: z.number().int().min(1).max(1_000_000),
  i: z
    .array(
      z.object({
        id: z.number().int().positive(),
        q: z.number().int().min(1).max(MAX_FIXTURE_QUANTITY),
        v: z
          .array(
            z.object({
              attribute: z.string().max(120),
              value: z.string().max(200),
            }),
          )
          .max(10)
          .optional(),
      }),
    )
    .max(50),
  c: z.array(z.string().max(64)).max(10),
  r: z.string().min(1).max(128),
  s: z.tuple([z.string().max(8), z.string().max(32), z.string().max(120)]).optional(),
});

const fixtureSessions = new Map<string, FixtureCartSessionState>();

export function resetFixtureCartSessions(): void {
  fixtureSessions.clear();
}

function buildFixtureLineKey(
  id: number,
  variation: ReadonlyArray<{ attribute: string; value: string }>,
): string {
  if (variation.length === 0) {
    return `fixture-item-${id}`;
  }
  const canonical = [...variation]
    .map((entry) => ({
      a: entry.attribute.trim().toLowerCase(),
      v: entry.value.trim().toLowerCase(),
    }))
    .sort((x, y) => x.a.localeCompare(y.a) || x.v.localeCompare(y.v))
    .map((entry) => `${encodeURIComponent(entry.a)}=${encodeURIComponent(entry.v)}`)
    .join("&");
  let hash = 0xcbf29ce484222325n;
  for (let i = 0; i < canonical.length; i += 1) {
    hash ^= BigInt(canonical.charCodeAt(i));
    hash = BigInt.asUintN(64, hash * 0x100000001b3n);
  }
  return `fixture-item-${id}-${hash.toString(16).padStart(16, "0")}`;
}

function setBoundedFixtureSession(key: string, state: FixtureCartSessionState): void {
  fixtureSessions.delete(key);
  fixtureSessions.set(key, state);
  while (fixtureSessions.size > MAX_FIXTURE_SESSIONS) {
    const oldestKey = fixtureSessions.keys().next().value;
    if (oldestKey === undefined) break;
    fixtureSessions.delete(oldestKey);
  }
}

function encodeFixtureToken(state: FixtureCartSessionState): string {
  const addr = state.shippingAddress;
  const hasCustomAddr = addr.country !== "HU" || addr.postcode !== "" || addr.city !== "";
  const snapshot: z.infer<typeof fixtureTokenSnapshotSchema> = {
    n: state.nonceCounter,
    i: state.items.map((line) => ({
      id: line.id,
      q: line.quantity,
      ...(line.variation.length > 0 ? { v: line.variation } : {}),
    })),
    c: state.coupons,
    r: state.selectedRateId,
    ...(hasCustomAddr ? { s: [addr.country, addr.postcode, addr.city] } : {}),
  };
  const encoded = Buffer.from(JSON.stringify(snapshot), "utf8").toString("base64url");
  return `${FIXTURE_TOKEN_PREFIX}${state.brandId}-${state.sessionId}.${encoded}`;
}

function parseFixtureToken(token: string): {
  tokenBrand: string;
  sessionId: string;
  snapshot?: z.infer<typeof fixtureTokenSnapshotSchema>;
} | null {
  if (!token.startsWith(FIXTURE_TOKEN_PREFIX)) return null;
  const rest = token.slice(FIXTURE_TOKEN_PREFIX.length);
  const dotIdx = rest.indexOf(".");
  const header = dotIdx === -1 ? rest : rest.slice(0, dotIdx);
  const encodedPayload = dotIdx === -1 ? undefined : rest.slice(dotIdx + 1);

  const lastDash = header.lastIndexOf("-");
  if (lastDash <= 0 || lastDash === header.length - 1) return null;
  const tokenBrand = header.slice(0, lastDash);
  const sessionId = header.slice(lastDash + 1);
  if (!/^[a-z0-9-]+$/i.test(tokenBrand) || !/^(?:\d+|[a-f0-9]{32})$/i.test(sessionId)) {
    return null;
  }

  if (!encodedPayload) {
    return { tokenBrand, sessionId };
  }

  try {
    const decoded = Buffer.from(encodedPayload, "base64url").toString("utf8");
    const parsed = fixtureTokenSnapshotSchema.safeParse(JSON.parse(decoded));
    if (!parsed.success) return { tokenBrand, sessionId };
    return { tokenBrand, sessionId, snapshot: parsed.data };
  } catch {
    return { tokenBrand, sessionId };
  }
}

function defaultAddress(): StoreAddress {
  return {
    first_name: "",
    last_name: "",
    company: "",
    address_1: "",
    address_2: "",
    city: "",
    state: "",
    postcode: "",
    country: "HU",
    email: "",
    phone: "",
  };
}

function findProductOrVariation(id: number): {
  product: StoreProduct;
  variation: NonNullable<StoreProduct["extensions"]["kg_headless"]>["variations"] extends
    Array<infer V> | undefined
    ? V | undefined
    : undefined;
} | null {
  for (const product of fixtureProducts) {
    if (product.id === id) {
      return { product, variation: undefined };
    }
    const matched = product.extensions.kg_headless?.variations?.find((v) => v.id === id);
    if (matched) {
      return { product, variation: matched };
    }
  }
  return null;
}

function buildFixtureCart(state: FixtureCartSessionState): StoreCart {
  const items: StoreCartItem[] = [];
  let totalItemsMinor = 0;

  for (const line of state.items) {
    const found = findProductOrVariation(line.id);
    if (!found) continue;
    const { product, variation } = found;
    const prices = variation?.prices ?? product.prices;
    const unitMinor = Number.parseInt(prices.price, 10);
    const lineSubtotal = unitMinor * line.quantity;
    totalItemsMinor += lineSubtotal;

    const images = variation?.image ? [variation.image] : product.images;
    const resolvedVariation = variation
      ? variation.attributes.map((attr) => {
          if (attr.value) {
            return { attribute: attr.name, value: attr.value };
          }
          const matchedInput = line.variation.find(
            (v) => v.attribute === attr.taxonomy || v.attribute === attr.name,
          );
          const productAttr = product.attributes.find(
            (pa) => pa.taxonomy === attr.taxonomy || pa.name === attr.name,
          );
          const matchedTerm = productAttr?.terms.find(
            (t) => t.slug === matchedInput?.value || t.name === matchedInput?.value,
          );
          return {
            attribute: attr.name,
            value: matchedTerm?.name ?? matchedInput?.value ?? "",
          };
        })
      : line.variation.map((entry) => {
          const productAttr = product.attributes.find(
            (pa) => pa.taxonomy === entry.attribute || pa.name === entry.attribute,
          );
          const matchedTerm = productAttr?.terms.find(
            (t) => t.slug === entry.value || t.name === entry.value,
          );
          return {
            attribute: productAttr?.name ?? entry.attribute,
            value: matchedTerm?.name ?? entry.value,
          };
        });

    items.push({
      key: line.key,
      id: variation?.id ?? product.id,
      quantity: line.quantity,
      name: product.name,
      slug: product.slug,
      sku: variation?.sku || product.sku,
      short_description: product.short_description,
      prices,
      totals: {
        line_subtotal: String(lineSubtotal),
        line_subtotal_tax: "0",
        line_total: String(lineSubtotal),
        line_total_tax: "0",
        currency_code: prices.currency_code,
        currency_minor_unit: prices.currency_minor_unit,
      },
      images,
      variation: resolvedVariation,
    });
  }

  let totalDiscountMinor = 0;
  const coupons: StoreCartCoupon[] = [];
  for (const rawCode of state.coupons) {
    const def = FIXTURE_COUPONS[rawCode.toUpperCase()];
    if (!def) continue;
    const discount = Math.round((totalItemsMinor * def.percent) / 100);
    totalDiscountMinor += discount;
    coupons.push({
      code: def.code,
      discount_type: "percent",
      totals: {
        total_discount: String(discount),
        total_discount_tax: "0",
        currency_code: "HUF",
        currency_minor_unit: 0,
      },
    });
  }
  if (totalDiscountMinor > totalItemsMinor) {
    totalDiscountMinor = totalItemsMinor;
  }

  const discountedItemsMinor = Math.max(0, totalItemsMinor - totalDiscountMinor);
  const itemsCount = items.reduce((sum, item) => sum + item.quantity, 0);
  const hasItems = itemsCount > 0;
  const country = (state.shippingAddress.country || "HU").toUpperCase();
  const isHu = country === "HU";

  const availableRates: StoreShippingRate[] = [];
  if (hasItems) {
    if (isHu) {
      availableRates.push(
        {
          rate_id: "flat_rate:1",
          name: "Házhozszállítás (GLS)",
          description: "1–3 munkanap",
          delivery_time: "1–3 munkanap",
          price: "1490",
          taxes: "0",
          method_id: "flat_rate",
          instance_id: 1,
          selected: false,
          currency_code: "HUF",
          currency_minor_unit: 0,
        },
        {
          rate_id: "local_pickup:2",
          name: "Csomagautomata",
          description: "1–2 munkanap",
          delivery_time: "1–2 munkanap",
          price: "990",
          taxes: "0",
          method_id: "local_pickup",
          instance_id: 2,
          selected: false,
          currency_code: "HUF",
          currency_minor_unit: 0,
        },
      );
      if (discountedItemsMinor >= FIXTURE_FREE_SHIPPING_THRESHOLD) {
        availableRates.push({
          rate_id: "free_shipping:3",
          name: "Ingyenes szállítás",
          description: "25 000 Ft feletti rendelés esetén",
          delivery_time: "1–3 munkanap",
          price: "0",
          taxes: "0",
          method_id: "free_shipping",
          instance_id: 3,
          selected: false,
          currency_code: "HUF",
          currency_minor_unit: 0,
        });
      }
    } else {
      availableRates.push({
        rate_id: "flat_rate:4",
        name: "Nemzetközi futárszolgálat (EU)",
        description: "3–5 munkanap",
        delivery_time: "3–5 munkanap",
        price: "3990",
        taxes: "0",
        method_id: "flat_rate",
        instance_id: 4,
        selected: false,
        currency_code: "HUF",
        currency_minor_unit: 0,
      });
    }
  }

  let selectedRate = availableRates.find((r) => r.rate_id === state.selectedRateId);
  if (!selectedRate && availableRates.length > 0) {
    selectedRate = availableRates[0];
    state.selectedRateId = selectedRate!.rate_id;
  }

  const markedRates = availableRates.map((rate) => ({
    ...rate,
    selected: selectedRate ? rate.rate_id === selectedRate.rate_id : false,
  }));

  const shippingMinor = selectedRate ? Number.parseInt(selectedRate.price, 10) : 0;
  const totalPriceMinor = hasItems ? discountedItemsMinor + shippingMinor : 0;

  return cartSchema.parse({
    coupons,
    shipping_rates:
      hasItems && markedRates.length > 0
        ? [
            {
              package_id: 0,
              name: "Szállítás",
              shipping_rates: markedRates,
            },
          ]
        : [],
    shipping_address: state.shippingAddress,
    billing_address: state.billingAddress,
    items,
    items_count: itemsCount,
    items_weight: 0,
    needs_payment: totalPriceMinor > 0,
    needs_shipping: hasItems,
    totals: {
      total_items: String(totalItemsMinor),
      total_items_tax: "0",
      total_fees: "0",
      total_fees_tax: "0",
      total_discount: String(totalDiscountMinor),
      total_discount_tax: "0",
      total_shipping: hasItems ? String(shippingMinor) : null,
      total_shipping_tax: hasItems ? "0" : null,
      total_price: String(totalPriceMinor),
      total_tax: "0",
      currency_code: "HUF",
      currency_minor_unit: 0,
    },
    payment_methods: ["stripe", "barion", "simplepay"],
    errors: [],
  });
}

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
  if (query.include?.length) {
    const allowed = new Set(query.include);
    products = products.filter((p) => allowed.has(p.id));
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

export type FixtureStoreClientOptions = {
  brandId?: string;
};

/** Woo nélküli futáshoz (CI e2e, lokális fejlesztés Docker nélkül). */
export function createFixtureStoreClient(options: FixtureStoreClientOptions = {}): StoreClient {
  const brandId = options.brandId ?? "default";

  function resolveSession(session?: CartSession): FixtureCartSessionState {
    const token = session?.cartToken;
    if (token && (token === "expired" || token.startsWith("expired-"))) {
      throw new WooError("CART.SESSION_INVALID", "Fixture kosár munkamenet lejárt.", {
        status: 401,
        wooCode: "woocommerce_rest_cart_token_invalid",
      });
    }

    if (token) {
      const parsedToken = parseFixtureToken(token);
      if (!parsedToken || parsedToken.tokenBrand !== brandId) {
        throw new WooError(
          "CART.SESSION_INVALID",
          parsedToken ? "Másik brand kosártokenje." : "Ismeretlen fixture kosártoken.",
          { status: 401, wooCode: "woocommerce_rest_cart_token_invalid" },
        );
      }

      const sessionKey = `${brandId}:${parsedToken.sessionId}`;
      const existing = fixtureSessions.get(sessionKey);
      // Csak akkor használjuk a memóriabeli állapotot, ha nem elavultabb a cookie-snapshotnál
      // (Isolate 1 -> Isolate 2 módosítás -> visszatérés Isolate 1-re esetén a frissebb snapshot győz).
      if (existing && (!parsedToken.snapshot || existing.nonceCounter >= parsedToken.snapshot.n)) {
        setBoundedFixtureSession(sessionKey, existing);
        return existing;
      }

      // Új/hideg vagy elavult Workers izolátumon az érvényes token-snapshotból állítjuk vissza a
      // fixture-kosarat; ha nincs snapshot (pl. ismeretlen/kézzel írt token), 401-gyel elutasítjuk.
      if (!parsedToken.snapshot) {
        throw new WooError("CART.SESSION_INVALID", "Ismeretlen fixture kosártoken.", {
          status: 401,
          wooCode: "woocommerce_rest_cart_token_invalid",
        });
      }

      const snap = parsedToken.snapshot;
      const shippingAddress = defaultAddress();
      if (snap.s) {
        shippingAddress.country = snap.s[0] || "HU";
        shippingAddress.postcode = snap.s[1];
        shippingAddress.city = snap.s[2];
      }
      const hydrated: FixtureCartSessionState = {
        brandId,
        sessionId: parsedToken.sessionId,
        cartToken: token,
        nonceCounter: snap.n,
        items: snap.i.map((entry) => {
          const variation = entry.v ?? [];
          return {
            key: buildFixtureLineKey(entry.id, variation),
            id: entry.id,
            quantity: entry.q,
            variation,
          };
        }),
        coupons: snap.c.filter((code) => Boolean(FIXTURE_COUPONS[code.toUpperCase()])),
        selectedRateId: snap.r,
        shippingAddress,
        billingAddress: defaultAddress(),
      };
      hydrated.cartToken = encodeFixtureToken(hydrated);
      setBoundedFixtureSession(sessionKey, hydrated);
      return hydrated;
    }

    const sessionId = globalThis.crypto.randomUUID().replace(/-/g, "");
    const created: FixtureCartSessionState = {
      brandId,
      sessionId,
      cartToken: "",
      nonceCounter: 1,
      items: [],
      coupons: [],
      selectedRateId: "flat_rate:1",
      shippingAddress: defaultAddress(),
      billingAddress: defaultAddress(),
    };
    created.cartToken = encodeFixtureToken(created);
    setBoundedFixtureSession(`${brandId}:${sessionId}`, created);
    return created;
  }

  function toResult(state: FixtureCartSessionState, bumpNonce = false): StoreCartResult {
    if (bumpNonce) {
      state.nonceCounter += 1;
    }
    const cart = buildFixtureCart(state);
    state.cartToken = encodeFixtureToken(state);
    return {
      cart,
      cartToken: state.cartToken,
      nonce: `fixture-nonce-${state.nonceCounter}`,
    };
  }

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
      const state = resolveSession(session);
      return toResult(state, false);
    },
    async addCartItem(input, session) {
      const state = resolveSession(session);
      if (!Number.isInteger(input.quantity) || input.quantity < 1) {
        throw new WooError("CART.INVALID_QUANTITY", "Érvénytelen darabszám.", { status: 400 });
      }
      const found = findProductOrVariation(input.id);
      if (!found) {
        throw new WooError("CART.OUT_OF_STOCK", "A termék nem található.", { status: 400 });
      }
      const inStock = found.variation ? found.variation.is_in_stock : found.product.is_in_stock;
      const purchasable = found.variation
        ? found.variation.is_purchasable
        : found.product.is_purchasable;
      if (!inStock || !purchasable) {
        throw new WooError("CART.OUT_OF_STOCK", "A termék elfogyott.", { status: 409 });
      }

      const variationEntries = input.variation ?? [];
      const key = buildFixtureLineKey(input.id, variationEntries);
      const existing = state.items.find((item) => item.key === key);
      const nextQty = (existing?.quantity ?? 0) + input.quantity;
      const maxStock = found.variation?.low_stock_remaining ?? found.product.low_stock_remaining;
      if (nextQty > MAX_FIXTURE_QUANTITY) {
        throw new WooError("CART.INVALID_QUANTITY", "Túl nagy mennyiség.", { status: 400 });
      }
      if (typeof maxStock === "number" && maxStock > 0 && nextQty > maxStock) {
        throw new WooError("CART.OUT_OF_STOCK", "Nincs elég készlet.", { status: 409 });
      }

      if (existing) {
        existing.quantity = nextQty;
      } else {
        state.items.push({
          key,
          id: input.id,
          quantity: input.quantity,
          variation: variationEntries,
        });
      }
      return toResult(state, true);
    },
    async updateCartItem(input, session) {
      const state = resolveSession(session);
      if (!Number.isInteger(input.quantity) || input.quantity < 0) {
        throw new WooError("CART.INVALID_QUANTITY", "Érvénytelen darabszám.", { status: 400 });
      }
      const existing = state.items.find((item) => item.key === input.key);
      if (!existing) {
        throw new WooError("CART.INVALID_INPUT", "A kosártétel nem található.", {
          status: 404,
          wooCode: "woocommerce_rest_cart_invalid_key",
        });
      }
      if (input.quantity === 0) {
        state.items = state.items.filter((item) => item.key !== input.key);
        if (state.items.length === 0) {
          state.coupons = [];
        }
      } else {
        if (input.quantity > MAX_FIXTURE_QUANTITY) {
          throw new WooError("CART.INVALID_QUANTITY", "Túl nagy mennyiség.", { status: 400 });
        }
        const found = findProductOrVariation(existing.id);
        const maxStock =
          found?.variation?.low_stock_remaining ?? found?.product.low_stock_remaining;
        if (typeof maxStock === "number" && maxStock > 0 && input.quantity > maxStock) {
          throw new WooError("CART.OUT_OF_STOCK", "Nincs elég készlet.", { status: 409 });
        }
        existing.quantity = input.quantity;
      }
      return toResult(state, true);
    },
    async removeCartItem(input, session) {
      const state = resolveSession(session);
      state.items = state.items.filter((item) => item.key !== input.key);
      if (state.items.length === 0) {
        state.coupons = [];
      }
      return toResult(state, true);
    },
    async clearCart(session) {
      const state = resolveSession(session);
      state.items = [];
      state.coupons = [];
      return toResult(state, true);
    },
    async applyCoupon(input, session) {
      const state = resolveSession(session);
      const normalized = input.code.trim().toUpperCase();
      if (!normalized || !FIXTURE_COUPONS[normalized]) {
        throw new WooError("CART.COUPON_INVALID", "Érvénytelen kuponkód.", {
          status: 400,
          wooCode: "woocommerce_rest_cart_coupon_error",
        });
      }
      if (!state.coupons.includes(normalized)) {
        state.coupons.push(normalized);
      }
      return toResult(state, true);
    },
    async removeCoupon(input, session) {
      const state = resolveSession(session);
      const normalized = input.code.trim().toUpperCase();
      state.coupons = state.coupons.filter((c) => c !== normalized);
      return toResult(state, true);
    },
    async selectShippingRate(input, session) {
      const state = resolveSession(session);
      const preview = buildFixtureCart(state);
      const rates = preview.shipping_rates[0]?.shipping_rates ?? [];
      const found = rates.find((r) => r.rate_id === input.rateId);
      if (!found) {
        throw new WooError("CART.SHIPPING_UNAVAILABLE", "Ismeretlen szállítási mód.", {
          status: 400,
          wooCode: "woocommerce_rest_invalid_shipping_rate",
        });
      }
      state.selectedRateId = input.rateId;
      return toResult(state, true);
    },
    async updateCustomer(input, session) {
      const state = resolveSession(session);
      if (input.shipping_address) {
        state.shippingAddress = {
          ...state.shippingAddress,
          ...input.shipping_address,
        };
      }
      if (input.billing_address) {
        state.billingAddress = {
          ...state.billingAddress,
          ...input.billing_address,
        };
      }
      return toResult(state, true);
    },
    async getCheckout() {
      return unsupported("getCheckout");
    },
    async submitCheckout() {
      return unsupported("submitCheckout");
    },
  };
}
