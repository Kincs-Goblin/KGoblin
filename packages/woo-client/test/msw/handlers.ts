import { http, HttpResponse } from "msw";

import { fixtureAttributes, fixtureCart, fixtureCategories, fixtureProducts } from "../fixtures";

/**
 * MSW handlerek a fő Store API végpontokra a KG-4 seedből rögzített valódi válaszokkal (`KG-41`).
 * Minden URL-prefixet támogat (`*` wildcard), így tetszőleges brand `baseUrl`-lel működik.
 */
export function createStoreApiHandlers(baseUrlPattern = "*") {
  const prefix = baseUrlPattern === "*" ? "*" : baseUrlPattern.replace(/\/+$/, "");

  return [
    http.get(`${prefix}/wp-json/wc/store/v1/products/categories`, () =>
      HttpResponse.json(fixtureCategories),
    ),

    http.get(`${prefix}/wp-json/wc/store/v1/products/attributes`, () =>
      HttpResponse.json(fixtureAttributes),
    ),

    http.get(`${prefix}/wp-json/wc/store/v1/products/attributes/:id/terms`, () =>
      HttpResponse.json([
        {
          id: 101,
          name: "Lineáris Red",
          slug: "linearis-red",
          description: "",
          menu_order: 1,
          count: 2,
        },
      ]),
    ),

    http.get(`${prefix}/wp-json/wc/store/v1/products/:id`, ({ params }) => {
      const id = Number(params.id);
      const product = fixtureProducts.find((item) => item.id === id);
      if (!product) {
        return HttpResponse.json(
          { code: "woocommerce_rest_product_invalid_id", message: "Érvénytelen termék." },
          { status: 404 },
        );
      }
      return HttpResponse.json(product);
    }),

    http.get(`${prefix}/wp-json/wc/store/v1/products`, ({ request }) => {
      const url = new URL(request.url);
      const slug = url.searchParams.get("slug");
      if (slug) {
        const match = fixtureProducts.filter((item) => item.slug === slug);
        return HttpResponse.json(match);
      }

      let list = [...fixtureProducts];
      const category = url.searchParams.get("category");
      if (category) {
        list = list.filter((item) => item.categories.some((c) => String(c.id) === category));
      }
      if (url.searchParams.get("on_sale") === "true") {
        list = list.filter((item) => item.on_sale);
      }
      const perPage = Number(url.searchParams.get("per_page") ?? "24");
      return HttpResponse.json(list.slice(0, Number.isFinite(perPage) ? perPage : 24));
    }),

    http.get(`${prefix}/wp-json/wc/store/v1/cart`, () =>
      HttpResponse.json(fixtureCart, {
        headers: {
          "Cart-Token": "msw-cart-token",
          Nonce: "msw-nonce",
        },
      }),
    ),

    http.post(`${prefix}/wp-json/wc/store/v1/cart/add-item`, async ({ request }) => {
      const body = (await request.json().catch(() => ({}))) as { id?: number; quantity?: number };
      const product = fixtureProducts.find((p) => p.id === body.id);
      if (!product) {
        return HttpResponse.json(
          { code: "woocommerce_rest_product_invalid_id", message: "Termék nem található." },
          { status: 400 },
        );
      }
      const quantity = body.quantity ?? 1;
      const updated = structuredClone(fixtureCart);
      updated.items[0] = {
        ...updated.items[0]!,
        id: product.id,
        name: product.name,
        slug: product.slug,
        sku: product.sku,
        quantity,
        prices: product.prices,
      };
      updated.items_count = quantity;
      return HttpResponse.json(updated, {
        headers: {
          "Cart-Token": "msw-cart-token-updated",
          Nonce: "msw-nonce-updated",
        },
      });
    }),

    http.post(`${prefix}/wp-json/wc/store/v1/cart/update-item`, async ({ request }) => {
      const body = (await request.json().catch(() => ({}))) as { quantity?: number };
      const updated = structuredClone(fixtureCart);
      const quantity = body.quantity ?? 1;
      if (updated.items[0]) updated.items[0].quantity = quantity;
      updated.items_count = quantity;
      return HttpResponse.json(updated, {
        headers: { "Cart-Token": "msw-cart-token", Nonce: "msw-nonce" },
      });
    }),

    http.post(`${prefix}/wp-json/wc/store/v1/cart/remove-item`, () => {
      const empty = structuredClone(fixtureCart);
      empty.items = [];
      empty.items_count = 0;
      empty.totals.total_items = "0";
      empty.totals.total_price = "0";
      return HttpResponse.json(empty, {
        headers: { "Cart-Token": "msw-cart-token", Nonce: "msw-nonce" },
      });
    }),

    http.post(`${prefix}/wp-json/wc/store/v1/cart/apply-coupon`, async ({ request }) => {
      const body = (await request.json().catch(() => ({}))) as { code?: string };
      if (!body.code || body.code.toUpperCase() === "INVALID") {
        return HttpResponse.json(
          { code: "woocommerce_rest_cart_coupon_error", message: "Érvénytelen kuponkód." },
          { status: 400 },
        );
      }
      const updated = structuredClone(fixtureCart);
      updated.coupons = [
        {
          code: body.code.toLowerCase(),
          discount_type: "percent",
          totals: {
            total_discount: "1000",
            total_discount_tax: "0",
            currency_code: "HUF",
            currency_minor_unit: 0,
          },
        },
      ];
      return HttpResponse.json(updated);
    }),

    http.post(`${prefix}/wp-json/wc/store/v1/cart/remove-coupon`, () =>
      HttpResponse.json(fixtureCart),
    ),

    http.post(`${prefix}/wp-json/wc/store/v1/cart/select-shipping-rate`, async ({ request }) => {
      const body = (await request.json().catch(() => ({}))) as { rate_id?: string };
      const updated = structuredClone(fixtureCart);
      const pkg = updated.shipping_rates[0];
      if (pkg && body.rate_id) {
        pkg.shipping_rates = pkg.shipping_rates.map((rate) => ({
          ...rate,
          selected: rate.rate_id === body.rate_id,
        }));
      }
      return HttpResponse.json(updated);
    }),

    http.get(`${prefix}/wp-json/wc/store/v1/checkout`, () =>
      HttpResponse.json({
        order_id: 0,
        status: "checkout-draft",
        order_key: "",
        customer_note: "",
        billing_address: fixtureCart.billing_address,
        shipping_address: fixtureCart.shipping_address,
        payment_method: "stripe",
        extensions: {},
      }),
    ),

    http.post(`${prefix}/wp-json/wc/store/v1/checkout`, async ({ request }) => {
      const body = (await request.json().catch(() => ({}))) as {
        billing_address?: Record<string, unknown>;
        shipping_address?: Record<string, unknown>;
        payment_method?: string;
        extensions?: { kg_headless?: { accept_terms?: boolean } };
      };
      if (body.extensions?.kg_headless?.accept_terms === false) {
        return HttpResponse.json(
          { code: "kg_terms_not_accepted", message: "Az ÁSZF elfogadása kötelező." },
          { status: 400 },
        );
      }
      return HttpResponse.json({
        order_id: 9001,
        status: "pending",
        order_key: "wc_order_msw_9001",
        order_number: "9001",
        customer_note: "",
        billing_address: body.billing_address ?? fixtureCart.billing_address,
        shipping_address: body.shipping_address ?? fixtureCart.shipping_address,
        payment_method: body.payment_method ?? "stripe",
        payment_result: {
          payment_status: "pending",
          payment_details: [],
          redirect_url: "https://pay.example.test/redirect/9001",
        },
        extensions: {},
      });
    }),
  ];
}

export const storeApiHandlers = createStoreApiHandlers();
