import { brands } from "@kg/brand-config";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it, vi } from "vitest";

import { isWooError } from "../errors";
import { createRestClient, createWooRestClient } from "./index";

const gamerBrand = brands[0]!;

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

describe("REST v3 server-only védelem", () => {
  it("a @kg/woo-client/rest belépési pont első importja a server-only", () => {
    const entryPath = fileURLToPath(new URL("./index.ts", import.meta.url));
    const source = readFileSync(entryPath, "utf8");
    expect(source.startsWith('import "server-only";')).toBe(true);
  });
});

describe("createWooRestClient(brand)", () => {
  it("hiányzó hitelesítő adatoknál a változó nevével áll le, titok nélkül", () => {
    expect(() =>
      createWooRestClient(gamerBrand, {
        env: { WOO_GAMER_URL: "https://woo.example.test" },
      }),
    ).toThrowError(/WOO_GAMER_CONSUMER_KEY/);

    expect(() =>
      createWooRestClient(gamerBrand, {
        env: {
          WOO_GAMER_URL: "https://woo.example.test",
          WOO_GAMER_CONSUMER_KEY: "ck_test_123",
        },
      }),
    ).toThrowError(/WOO_GAMER_CONSUMER_SECRET/);
  });

  it("HTTPS esetén Authorization Basic fejlécet használ és nem teszi a kulcsot URL-be", async () => {
    const fetchMock = vi.fn(async () =>
      jsonResponse([
        {
          id: 10,
          name: "Gamer Egérpad",
          slug: "gamer-egerpad",
          type: "simple",
          status: "publish",
          sku: "KG-PAD-1",
          price: "9990",
        },
      ]),
    );

    const rest = createWooRestClient(gamerBrand, {
      env: {
        WOO_GAMER_URL: "https://woo.example.test",
        WOO_GAMER_CONSUMER_KEY: "ck_secret_key",
        WOO_GAMER_CONSUMER_SECRET: "cs_secret_val",
      },
      fetch: fetchMock,
    });

    const products = await rest.listProducts({ sku: "KG-PAD-1" });
    expect(products).toHaveLength(1);

    const [calledUrl, init] = fetchMock.mock.calls[0] as unknown as [URL, RequestInit];
    expect(calledUrl.searchParams.has("consumer_key")).toBe(false);
    expect(calledUrl.searchParams.has("consumer_secret")).toBe(false);
    const headers = init.headers as Record<string, string>;
    expect(headers.Authorization).toBe(
      `Basic ${Buffer.from("ck_secret_key:cs_secret_val").toString("base64")}`,
    );
  });

  it("HTTP hálózati hibánál kiszűri a consumer key/secret értéket a hibaüzenetből", async () => {
    const ck = "ck_super_secret_999";
    const cs = "cs_super_secret_888";
    const rest = createRestClient({
      baseUrl: "http://localhost:8080",
      consumerKey: ck,
      consumerSecret: cs,
      fetch: async (url) => {
        throw new Error(`request to ${String(url)} failed`);
      },
    });

    const err = await rest.listProducts().catch((e: unknown) => e);
    expect(isWooError(err)).toBe(true);
    expect((err as Error).message).not.toContain(ck);
    expect((err as Error).message).not.toContain(cs);
  });

  it("támogatja a products/batch végpontot és a részeredmény hibákat is validálja", async () => {
    const fetchMock = vi.fn(async () =>
      jsonResponse({
        create: [
          {
            id: 101,
            name: "Új termék",
            slug: "uj-termek",
            status: "publish",
            sku: "SKU-101",
          },
        ],
        update: [
          {
            id: 102,
            error: {
              code: "woocommerce_rest_product_invalid_id",
              message: "Érvénytelen ID.",
              data: { status: 400 },
            },
          },
        ],
        delete: [],
      }),
    );

    const rest = createWooRestClient(gamerBrand, {
      env: {
        WOO_GAMER_URL: "https://woo.example.test",
        WOO_GAMER_CONSUMER_KEY: "ck_a",
        WOO_GAMER_CONSUMER_SECRET: "cs_a",
      },
      fetch: fetchMock,
    });

    const batch = await rest.batchProducts({
      create: [{ name: "Új termék", sku: "SKU-101", regular_price: "12990" }],
      update: [{ id: 102, regular_price: "13990" }],
    });

    expect(batch.create).toHaveLength(1);
    expect("error" in batch.update[0]! && batch.update[0].error.code).toBe(
      "woocommerce_rest_product_invalid_id",
    );
  });

  it("order olvasás, frissítés, megjegyzés és Zod hibakezelés", async () => {
    const rest = createRestClient({
      baseUrl: "https://woo.example.test",
      consumerKey: "ck",
      consumerSecret: "cs",
      fetch: async (input) => {
        const url = new URL(String(input));
        if (url.pathname.endsWith("/orders/404")) {
          return jsonResponse({ code: "woocommerce_rest_shop_order_invalid_id" }, 404);
        }
        if (url.pathname.endsWith("/orders/55/notes")) {
          return jsonResponse({ id: 7, note: "Továbbítva", customer_note: false });
        }
        if (url.pathname.endsWith("/orders/55")) {
          return jsonResponse({
            id: 55,
            number: "55",
            status: "processing",
            currency: "HUF",
            total: "16990",
          });
        }
        return jsonResponse({ bad: true });
      },
    });

    expect(await rest.getOrder(404)).toBeNull();
    const order = await rest.updateOrder(55, { status: "processing" });
    expect(order.status).toBe("processing");
    const note = await rest.addOrderNote(55, "Továbbítva");
    expect(note.id).toBe(7);

    await expect(rest.listProducts()).rejects.toMatchObject({ code: "WOO.CONTRACT_MISMATCH" });
  });

  it("külső HTTP címre (nem loopback) azonnal elutasítja a REST v3 klienst", () => {
    expect(() =>
      createRestClient({
        baseUrl: "http://woo.example.com",
        consumerKey: "ck",
        consumerSecret: "cs",
      }),
    ).toThrowError(/HTTPS/);
  });

  it("loopback HTTP-n one-legged OAuth 1.0a HMAC-SHA256 aláírást küld consumer_secret nélkül (matematikai ellenőrzéssel)", async () => {
    const { createHmac } = await import("node:crypto");
    const fetchMock = vi.fn(async () => jsonResponse([]));
    const rest = createRestClient({
      baseUrl: "http://localhost:8080",
      consumerKey: "ck_loopback",
      consumerSecret: "cs_super_secret",
      fetch: fetchMock,
    });

    await rest.listProducts({ perPage: 5, sku: "KG+1 ~ teszt!" });

    const [calledUrl, init] = fetchMock.mock.calls[0] as unknown as [URL, RequestInit];
    expect(calledUrl.searchParams.has("consumer_key")).toBe(false);
    expect(calledUrl.searchParams.has("consumer_secret")).toBe(false);
    expect(calledUrl.searchParams.get("oauth_consumer_key")).toBe("ck_loopback");
    expect(calledUrl.searchParams.get("oauth_signature_method")).toBe("HMAC-SHA256");
    expect(calledUrl.searchParams.get("oauth_timestamp")).toMatch(/^\d+$/);
    expect(calledUrl.searchParams.get("oauth_nonce")).toMatch(/^[0-9a-f]{32}$/);

    const rfc3986 = (v: string) =>
      encodeURIComponent(v).replace(
        /[!'()*]/g,
        (c) => `%${c.charCodeAt(0).toString(16).toUpperCase()}`,
      );
    const params = Array.from(calledUrl.searchParams.entries())
      .filter(([k]) => k !== "oauth_signature")
      .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
      .map(([k, v]) => rfc3986(`${rfc3986(k)}=${rfc3986(v)}`))
      .join("%26");
    const stringToSign = `GET&${rfc3986("http://localhost:8080/wp-json/wc/v3/products")}&${params}`;
    const expectedSig = createHmac("sha256", "cs_super_secret&")
      .update(stringToSign)
      .digest("base64");
    expect(calledUrl.searchParams.get("oauth_signature")).toBe(expectedSig);

    const headers = init.headers as Record<string, string>;
    expect(headers.Authorization).toBeUndefined();
  });

  it("REST v3 401/403 WOO.UNAVAILABLE, míg a REST 400 stock/quantity WOO.INVALID_RESPONSE marad", async () => {
    const rest401 = createRestClient({
      baseUrl: "https://woo.example.test",
      consumerKey: "ck",
      consumerSecret: "cs",
      fetch: async () =>
        jsonResponse({ code: "woocommerce_rest_cannot_view", message: "Nincs jogosultság." }, 401),
    });
    await expect(rest401.listProducts()).rejects.toMatchObject({
      code: "WOO.UNAVAILABLE",
      status: 401,
    });

    const rest403 = createRestClient({
      baseUrl: "https://woo.example.test",
      consumerKey: "ck",
      consumerSecret: "cs",
      fetch: async () =>
        jsonResponse({ code: "woocommerce_rest_cannot_create", message: "Tiltott." }, 403),
    });
    await expect(rest403.batchProducts({ create: [] })).rejects.toMatchObject({
      code: "WOO.UNAVAILABLE",
      status: 403,
    });

    const rest400Stock = createRestClient({
      baseUrl: "https://woo.example.test",
      consumerKey: "ck",
      consumerSecret: "cs",
      fetch: async () =>
        jsonResponse(
          { code: "woocommerce_rest_product_invalid_stock", message: "Hibás készlet." },
          400,
        ),
    });
    await expect(rest400Stock.batchProducts({ update: [] })).rejects.toMatchObject({
      code: "WOO.INVALID_RESPONSE",
      status: 400,
    });
  });
});
