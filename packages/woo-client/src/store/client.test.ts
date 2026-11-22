import { brands } from "@kg/brand-config";
import { setupServer } from "msw/node";
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from "vitest";

import categoriesJson from "../../test/fixtures/categories.json";
import cartJson from "../../test/fixtures/cart.json";
import productBySlugJson from "../../test/fixtures/product-by-slug.json";
import productsJson from "../../test/fixtures/products.json";
import { storeApiHandlers } from "../../test/msw";
import { isWooError } from "../errors";
import { createStoreClient, createWooClient } from "./client";

const server = setupServer(...storeApiHandlers);

beforeAll(() => {
  server.listen({ onUnhandledFrame: "error" });
});

afterEach(() => {
  server.resetHandlers();
});

afterAll(() => {
  server.close();
});

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

const gamerBrand = brands[0]!;

describe("createStoreClient", () => {
  it("a valódi Store API-válaszokat a sémán át adja vissza", async () => {
    const fetchMock = vi.fn(async () => jsonResponse(productsJson));
    const client = createStoreClient({ baseUrl: "http://woo.test/", fetch: fetchMock });

    const products = await client.getProducts({ category: "16", perPage: 8 });

    expect(products).toHaveLength(productsJson.length);
    expect(products[0]?.prices.currency_code).toBe("HUF");
    const url = new URL(String((fetchMock.mock.calls[0] as unknown[])[0]));
    expect(url.pathname).toBe("/wp-json/wc/store/v1/products");
    expect(url.searchParams.get("category")).toBe("16");
    expect(url.searchParams.get("per_page")).toBe("8");
  });

  it("a kg-headless Omnibus- és variáció-kiterjesztést megtartja", async () => {
    const client = createStoreClient({
      baseUrl: "http://woo.test",
      fetch: async () => jsonResponse(productsJson),
    });
    const products = await client.getProducts();
    const saleSimple = products.find((p) => p.on_sale && p.type === "simple");
    expect(saleSimple?.extensions.kg_headless?.lowest_price_30_days).toEqual(expect.any(Number));
    expect(saleSimple?.extensions.kg_headless?.delivery_time).toEqual(expect.any(String));

    const variable = products.find((p) => p.type === "variable");
    expect(variable?.extensions.kg_headless?.variations?.length).toBeGreaterThan(0);
  });

  it("elfogadja a lokális attribútum null taxonomy-ját és az Any variáció üres slug-ját", async () => {
    const base = structuredClone(productsJson.find((p) => p.type === "variable")!) as Record<
      string,
      unknown
    >;
    base.attributes = [
      {
        id: 0,
        name: "Anyag",
        taxonomy: null,
        has_variations: true,
        terms: [
          { id: 0, name: "Acél", slug: "Acél" },
          { id: 0, name: "Titán", slug: "Titán" },
        ],
      },
    ];
    const ext = structuredClone(
      (base.extensions as { kg_headless: { variations: Array<Record<string, unknown>> } })
        .kg_headless,
    );
    ext.variations = [
      {
        ...ext.variations[0]!,
        attributes: [{ name: "Anyag", taxonomy: "anyag", value: "", slug: "" }],
      },
    ];
    base.extensions = { kg_headless: ext };

    const client = createStoreClient({
      baseUrl: "http://woo.test",
      fetch: async () => jsonResponse([base]),
    });
    const [parsed] = await client.getProducts();
    expect(parsed?.attributes[0]?.taxonomy).toBe("");
    expect(parsed?.extensions.kg_headless?.variations?.[0]?.attributes[0]?.slug).toBe("");
  });

  it("getProductsPage kiolvassa az X-WP-Total / X-WP-TotalPages fejléceket és szerializálja a szűrőket", async () => {
    const fetchMock = vi.fn(
      async () =>
        new Response(JSON.stringify(productsJson.slice(0, 2)), {
          status: 200,
          headers: {
            "Content-Type": "application/json",
            "X-WP-Total": "12",
            "X-WP-TotalPages": "6",
          },
        }),
    );
    const client = createStoreClient({ baseUrl: "http://woo.test", fetch: fetchMock });

    const page = await client.getProductsPage({
      featured: true,
      page: 2,
      perPage: 2,
      stockStatus: "instock",
      attributes: [{ attribute: "pa_szin", slug: "goblin-arany", operator: "in" }],
    });

    expect(page.total).toBe(12);
    expect(page.totalPages).toBe(6);
    expect(page.products).toHaveLength(2);

    const url = new URL(String((fetchMock.mock.calls[0] as unknown[])[0]));
    expect(url.searchParams.get("featured")).toBe("true");
    expect(url.searchParams.get("page")).toBe("2");
    expect(url.searchParams.get("stock_status")).toBe("instock");
    expect(url.searchParams.get("attributes[0][attribute]")).toBe("pa_szin");
    expect(url.searchParams.get("attributes[0][slug]")).toBe("goblin-arany");
    expect(url.searchParams.get("attributes[0][operator]")).toBe("in");
  });

  it("slug és id alapján egy terméket ad, nem találatnál null-t", async () => {
    const found = createStoreClient({
      baseUrl: "http://woo.test",
      fetch: async () => jsonResponse(productBySlugJson),
    });
    expect((await found.getProductBySlug("x"))?.slug).toBe(productBySlugJson[0]?.slug);

    const empty = createStoreClient({
      baseUrl: "http://woo.test",
      fetch: async () => jsonResponse([]),
    });
    expect(await empty.getProductBySlug("nincs")).toBeNull();

    const notFoundById = createStoreClient({
      baseUrl: "http://woo.test",
      fetch: async () => jsonResponse({ code: "woocommerce_rest_product_invalid_id" }, 404),
    });
    expect(await notFoundById.getProductById(99999)).toBeNull();
  });

  it("a kategóriákat validálja", async () => {
    const client = createStoreClient({
      baseUrl: "http://woo.test",
      fetch: async () => jsonResponse(categoriesJson),
    });
    expect(await client.getCategories()).toHaveLength(categoriesJson.length);
  });

  it("hálózati hibára és 5xx-re WOO.UNAVAILABLE", async () => {
    const down = createStoreClient({
      baseUrl: "http://woo.test",
      fetch: async () => {
        throw new TypeError("fetch failed");
      },
    });
    await expect(down.getProducts()).rejects.toMatchObject({ code: "WOO.UNAVAILABLE" });

    const error500 = createStoreClient({
      baseUrl: "http://woo.test",
      fetch: async () => jsonResponse({ code: "x" }, 500),
    });
    const error = await error500.getProducts().catch((e: unknown) => e);
    expect(isWooError(error) && error.status).toBe(500);
  });

  it("érvénytelen JSON válaszra WOO.INVALID_RESPONSE hibát ad", async () => {
    const client = createStoreClient({
      baseUrl: "http://woo.test",
      fetch: async () => new Response("<html>502 bad json</html>", { status: 200 }),
    });
    await expect(client.getProducts()).rejects.toMatchObject({ code: "WOO.INVALID_RESPONSE" });
  });

  it("hiányzó kötelező mezőre WOO.CONTRACT_MISMATCH", async () => {
    const broken = structuredClone(productsJson) as Array<Record<string, unknown>>;
    delete broken[0]!.prices;
    const client = createStoreClient({
      baseUrl: "http://woo.test",
      fetch: async () => jsonResponse(broken),
    });
    await expect(client.getProducts()).rejects.toMatchObject({ code: "WOO.CONTRACT_MISMATCH" });
  });
});

describe("createWooClient(brand) + MSW Store API", () => {
  it("a brandből veszi a végpontot és elszigeteli a brandeket", async () => {
    const brandB = structuredClone(gamerBrand);
    brandB.id = "masik";
    brandB.woo.baseUrlEnv = "WOO_MASIK_URL";

    const calls: string[] = [];
    const env = {
      WOO_GAMER_URL: "https://woo-gamer.example.test",
      WOO_MASIK_URL: "https://woo-masik.example.test",
    };

    const clientA = createWooClient(gamerBrand, {
      env,
      fetch: async (input, init) => {
        calls.push(String(input));
        return fetch(input, init);
      },
    });
    const clientB = createWooClient(brandB, {
      env,
      fetch: async (input, init) => {
        calls.push(String(input));
        return fetch(input, init);
      },
    });

    expect(clientA.brandId).toBe("gamer");
    expect(clientB.brandId).toBe("masik");

    await clientA.getCategories();
    await clientB.getCategories();

    expect(calls[0]).toMatch(/^https:\/\/woo-gamer\.example\.test\//);
    expect(calls[1]).toMatch(/^https:\/\/woo-masik\.example\.test\//);
  });

  it("hiányzó vagy hibás brand env esetén WOO.UNAVAILABLE értékszivárgás nélkül", () => {
    expect(() => createWooClient(gamerBrand, { env: {} })).toThrowError(/WOO_GAMER_URL/);

    const badSecretLikeValue = "secret-invalid-url-xyz";
    let caught: unknown;
    try {
      createWooClient(gamerBrand, { env: { WOO_GAMER_URL: badSecretLikeValue } });
    } catch (error) {
      caught = error;
    }
    expect(isWooError(caught)).toBe(true);
    expect((caught as Error).message).not.toContain(badSecretLikeValue);
  });

  it("MSW-n át kezeli az attribútumokat, a kosár életciklust és a checkoutot", async () => {
    const client = createWooClient(gamerBrand, {
      env: { WOO_GAMER_URL: "https://woo-gamer.example.test" },
    });

    const attributes = await client.getAttributes();
    expect(attributes).toHaveLength(3);
    const switchAttr = attributes.find((a) => a.taxonomy === "pa_kapcsolo")!;
    const terms = await client.getAttributeTerms(switchAttr.id);
    expect(terms.some((t) => t.slug === "linearis-red")).toBe(true);

    const cart1 = await client.getCart();
    expect(cart1.cartToken).toBe("msw-cart-token");
    expect(cart1.nonce).toBe("msw-nonce");

    const simpleProd = productsJson.find((p) => p.type === "simple")!;
    const added = await client.addCartItem(
      { id: simpleProd.id, quantity: 2 },
      { cartToken: cart1.cartToken, nonce: cart1.nonce },
    );
    expect(added.cart.items_count).toBe(2);
    expect(added.cartToken).toBe("msw-cart-token-updated");

    const updated = await client.updateCartItem(
      { key: added.cart.items[0]!.key, quantity: 3 },
      { cartToken: added.cartToken, nonce: added.nonce },
    );
    expect(updated.cart.items_count).toBe(3);

    const withCoupon = await client.applyCoupon(
      { code: "GOBLIN10" },
      { cartToken: updated.cartToken, nonce: updated.nonce },
    );
    expect(withCoupon.cart.coupons[0]?.code).toBe("goblin10");

    await expect(
      client.applyCoupon(
        { code: "INVALID" },
        { cartToken: updated.cartToken, nonce: updated.nonce },
      ),
    ).rejects.toMatchObject({ code: "CART.COUPON_INVALID" });

    const shipped = await client.selectShippingRate(
      { rateId: "local_pickup:2" },
      { cartToken: updated.cartToken, nonce: updated.nonce },
    );
    expect(
      shipped.cart.shipping_rates[0]?.shipping_rates.find((r) => r.rate_id === "local_pickup:2")
        ?.selected,
    ).toBe(true);

    const checkoutDraft = await client.getCheckout({
      cartToken: updated.cartToken,
      nonce: updated.nonce,
    });
    expect(checkoutDraft.checkout.status).toBe("checkout-draft");

    const address = {
      first_name: "Teszt",
      last_name: "Elek",
      address_1: "Kossuth u. 1.",
      city: "Budapest",
      postcode: "1053",
      country: "HU",
      email: "teszt@example.com",
    };

    await expect(
      client.submitCheckout(
        {
          billing_address: address,
          shipping_address: address,
          payment_method: "stripe",
          extensions: {
            kg_headless: {
              accept_terms: false,
              accept_payment_obligation: true,
            },
          },
        },
        { cartToken: updated.cartToken, nonce: updated.nonce },
      ),
    ).rejects.toMatchObject({
      code: "CHECKOUT.VALIDATION_FAILED",
      wooCode: "kg_terms_not_accepted",
    });

    const submitted = await client.submitCheckout(
      {
        billing_address: address,
        shipping_address: address,
        payment_method: "stripe",
        extensions: {
          kg_headless: {
            accept_terms: true,
            accept_payment_obligation: true,
          },
        },
      },
      { cartToken: updated.cartToken, nonce: updated.nonce },
    );
    expect(submitted.checkout.order_id).toBe(9001);
    expect(submitted.checkout.payment_result?.redirect_url).toBe(
      "https://pay.example.test/redirect/9001",
    );
  });

  it("a getCart() session nélkül is cache: no-store opcióval fut, és kontextus szerint képez hibakódot", async () => {
    const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
      const url = new URL(String(input));
      if (url.pathname.endsWith("/cart/add-item")) {
        return jsonResponse(
          { code: "woocommerce_rest_invalid_param", message: "Hibás paraméter" },
          400,
        );
      }
      if (url.pathname.endsWith("/cart/update-item")) {
        return jsonResponse(
          { code: "woocommerce_rest_cart_token_invalid", message: "Lejárt token" },
          401,
        );
      }
      return jsonResponse(cartJson);
    });

    const client = createStoreClient({ baseUrl: "https://woo.example.test", fetch: fetchMock });
    await client.getCart();

    const [, init] = fetchMock.mock.calls[0] as unknown as [URL, RequestInit];
    expect(init.cache).toBe("no-store");

    await expect(client.addCartItem({ id: 1, quantity: 1 })).rejects.toMatchObject({
      code: "WOO.INVALID_RESPONSE",
    });

    await expect(
      client.updateCartItem({ key: "k", quantity: 2 }, { cartToken: "expired" }),
    ).rejects.toMatchObject({
      code: "CART.SESSION_INVALID",
    });
  });

  it("checkout fizetési hiba CHECKOUT.PAYMENT_DECLINED, míg a kg_payment_obligation_not_accepted CHECKOUT.VALIDATION_FAILED marad", async () => {
    const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = new URL(String(input));
      if (url.pathname.endsWith("/checkout") && init?.method === "POST") {
        const body = JSON.parse(String(init.body)) as { payment_method?: string };
        if (body.payment_method === "declined_card") {
          return jsonResponse(
            {
              code: "woocommerce_rest_checkout_process_payment_error",
              message: "A kártyás fizetés elutasítva.",
            },
            400,
          );
        }
        return jsonResponse(
          {
            code: "kg_payment_obligation_not_accepted",
            message: "Fizetési kötelezettség elfogadása kötelező.",
          },
          400,
        );
      }
      return jsonResponse({});
    });

    const client = createStoreClient({ baseUrl: "https://woo.example.test", fetch: fetchMock });
    const address = {
      first_name: "Teszt",
      last_name: "Elek",
      address_1: "Kossuth u. 1.",
      city: "Budapest",
      postcode: "1053",
      country: "HU",
      email: "teszt@example.com",
    };
    const baseCheckout = {
      billing_address: address,
      shipping_address: address,
    };

    await expect(
      client.submitCheckout(
        { ...baseCheckout, payment_method: "declined_card" },
        { cartToken: "t", nonce: "n" },
      ),
    ).rejects.toMatchObject({ code: "CHECKOUT.PAYMENT_DECLINED" });

    await expect(
      client.submitCheckout(
        { ...baseCheckout, payment_method: "stripe" },
        { cartToken: "t", nonce: "n" },
      ),
    ).rejects.toMatchObject({ code: "CHECKOUT.VALIDATION_FAILED" });
  });

  it("resolveSlugRedirect feloldja a régi termék-slugot, hibánál pedig fail-open null-t ad", async () => {
    const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
      const url = new URL(String(input));
      const slug = url.searchParams.get("slug");
      if (slug === "regi-slug") {
        return jsonResponse({
          found: true,
          type: "product",
          from: "regi-slug",
          to: "uj-slug",
          status: 301,
        });
      }
      if (slug === "loop-slug") {
        return jsonResponse({
          found: true,
          type: "product",
          from: "loop-slug",
          to: "loop-slug",
          status: 301,
        });
      }
      if (slug === "not-found") {
        return jsonResponse({
          found: false,
          type: "product",
          from: "not-found",
          to: null,
          status: null,
        });
      }
      if (slug === "server-error") {
        return jsonResponse({ code: "error" }, 500);
      }
      throw new TypeError("network down");
    });

    const client = createStoreClient({ baseUrl: "https://woo.example.test", fetch: fetchMock });

    expect(await client.resolveSlugRedirect("product", "regi-slug")).toBe("uj-slug");
    expect(await client.resolveSlugRedirect("product", "loop-slug")).toBeNull();
    expect(await client.resolveSlugRedirect("product", "not-found")).toBeNull();
    expect(await client.resolveSlugRedirect("product", "server-error")).toBeNull();
    expect(await client.resolveSlugRedirect("product", "offline")).toBeNull();
    expect(await client.resolveSlugRedirect("product", "   ")).toBeNull();
  });
});
