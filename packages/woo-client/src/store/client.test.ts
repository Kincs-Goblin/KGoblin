import { describe, expect, it, vi } from "vitest";

import categoriesJson from "../../test/fixtures/categories.json";
import productBySlugJson from "../../test/fixtures/product-by-slug.json";
import productsJson from "../../test/fixtures/products.json";
import { isWooError } from "../errors";
import { createStoreClient } from "./client";

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

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

  it("a kg-headless Omnibus-kiterjesztést megtartja", async () => {
    const client = createStoreClient({
      baseUrl: "http://woo.test",
      fetch: async () => jsonResponse(productsJson),
    });
    const [first] = await client.getProducts();
    expect(first?.extensions.kg_headless?.lowest_price_30_days).toEqual(expect.any(Number));
  });

  it("slug alapján egy terméket ad, nem találatnál null-t", async () => {
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
