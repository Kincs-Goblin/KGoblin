import { brands } from "@kg/brand-config";
import type { StoreProduct } from "@kg/woo-client";
import { describe, expect, it, vi } from "vitest";

import {
  createMeilisearchAdminClient,
  type MeilisearchAdminClient,
} from "../../adapters/meilisearch/client";
import { runFullReindex, runIncrementalReindex } from "../../trigger/reindex-search";
import { getMeilisearchAdminConfig } from "../env";
import { buildBrandIndexSettings, mapStoreProductToSearchDocument } from "./schema";

const gamerBrand = brands[0]!;

function sampleProduct(overrides: Partial<StoreProduct> = {}): StoreProduct {
  return {
    id: 101,
    name: "Rúnakard TKL &amp; Pro Billentyűzet",
    slug: "runakard-tkl-pro",
    sku: "RK-TKL-01",
    type: "simple",
    description: "<p>Hosszú leírás</p>",
    short_description: "<p>Mechanikus <b>gamer</b> billentyűzet.</p>",
    on_sale: true,
    is_in_stock: true,
    is_purchasable: true,
    is_on_backorder: false,
    low_stock_remaining: null,
    prices: {
      price: "36990",
      regular_price: "44990",
      sale_price: "36990",
      currency_code: "HUF",
      currency_minor_unit: 0,
    },
    images: [
      {
        id: 1,
        src: "https://cdn.example.com/kb.png",
        thumbnail: "https://cdn.example.com/kb-thumb.png",
        name: "kb",
        alt: "Rúnakard &amp; billentyűzet",
      },
    ],
    categories: [{ id: 10, name: "Billentyűzetek", slug: "billentyuzet" }],
    tags: [],
    attributes: [
      {
        id: 1,
        name: "Kapcsoló",
        taxonomy: "pa_kapcsolo",
        has_variations: false,
        terms: [{ id: 1, name: "Red", slug: "red" }],
      },
    ],
    average_rating: "4.8",
    review_count: 14,
    extensions: {},
    ...overrides,
  };
}

describe("Meilisearch keresési séma és beállítások (KG-48)", () => {
  it("Store API termékből minor unit árú, HTML-mentes dokumentumot képez le", () => {
    const doc = mapStoreProductToSearchDocument(sampleProduct(), gamerBrand);
    expect(doc).toEqual({
      id: 101,
      brandId: "gamer",
      name: "Rúnakard TKL & Pro Billentyűzet",
      slug: "runakard-tkl-pro",
      sku: "RK-TKL-01",
      shortDescription: "Mechanikus gamer billentyűzet.",
      priceMinor: 36990,
      regularPriceMinor: 44990,
      currency: "HUF",
      minorUnit: 0,
      onSale: true,
      inStock: true,
      stockStatus: "in_stock",
      categories: ["Billentyűzetek"],
      categorySlugs: ["billentyuzet"],
      attributes: { pa_kapcsolo: ["Red"] },
      attributeFacets: ["pa_kapcsolo:Red"],
      imageUrl: "https://cdn.example.com/kb-thumb.png",
      imageAlt: "Rúnakard & billentyűzet",
      popularity: 14,
    });
  });

  it("rögzített searchable/filterable/sortable mezőket és magyar szinonimákat ad", () => {
    const settings = buildBrandIndexSettings();
    expect(settings.searchableAttributes).toContain("name");
    expect(settings.filterableAttributes).toEqual(
      expect.arrayContaining(["brandId", "categorySlugs", "inStock", "onSale", "priceMinor"]),
    );
    expect(settings.sortableAttributes).toEqual(
      expect.arrayContaining(["priceMinor", "popularity", "name"]),
    );
    expect(settings.synonyms.billentyuzet).toContain("keyboard");
    expect(settings.stopWords).toContain("és");
    expect(settings.typoTolerance.enabled).toBe(true);
  });

  it("getMeilisearchAdminConfig hiányzó vagy hibás env esetén SEARCH.CONFIG_MISSING-et dob", () => {
    expect(() => getMeilisearchAdminConfig({})).toThrow(/Meilisearch konfiguráció/);
    expect(() =>
      getMeilisearchAdminConfig({ MEILISEARCH_URL: "not-a-url", MEILISEARCH_MASTER_KEY: "k" }),
    ).toThrow(/Meilisearch konfiguráció/);
    expect(
      getMeilisearchAdminConfig({
        MEILISEARCH_URL: "http://127.0.0.1:7700/",
        MEILISEARCH_MASTER_KEY: "secret-key",
      }),
    ).toEqual({ host: "http://127.0.0.1:7700", masterKey: "secret-key" });
  });
});

describe("Meilisearch újraindexelés (KG-49)", () => {
  function mockAdminClient(created = false): MeilisearchAdminClient & { calls: string[] } {
    const calls: string[] = [];
    return {
      calls,
      ensureIndex: vi.fn(async (uid: string) => {
        calls.push(`ensureIndex:${uid}`);
        return created;
      }),
      applyIndexSettings: vi.fn(async (uid: string) => {
        calls.push(`applySettings:${uid}`);
      }),
      upsertDocuments: vi.fn(async (uid: string, docs) => {
        calls.push(`upsert:${uid}:${docs.length}`);
      }),
      deleteDocuments: vi.fn(async (uid: string, ids) => {
        calls.push(`delete:${uid}:${ids.join(",")}`);
      }),
      swapIndexes: vi.fn(async (swaps) => {
        calls.push(`swap:${swaps[0]!.indexes.join("<->")}`);
      }),
      deleteIndex: vi.fn(async (uid: string) => {
        calls.push(`deleteIndex:${uid}`);
      }),
      ensureBrandSearchKey: vi.fn(),
    };
  }

  it("full-reindex temp indexen készíti elő az adatot, swapIndexes-szel cseréli és takarít", async () => {
    const meili = mockAdminClient();
    const result = await runFullReindex(
      { brandId: "gamer" },
      {
        meili,
        fetcher: {
          fetchAllProducts: vi.fn().mockResolvedValue([sampleProduct()]),
          fetchProductsByIds: vi.fn(),
        },
        now: () => 1700000000000,
      },
    );

    expect(result).toEqual({
      brandId: "gamer",
      indexUid: "products_gamer",
      indexedCount: 1,
      durationMs: 0,
    });
    expect(meili.calls).toEqual([
      "ensureIndex:products_gamer",
      "ensureIndex:products_gamer_tmp_1700000000000",
      "applySettings:products_gamer_tmp_1700000000000",
      "upsert:products_gamer_tmp_1700000000000:1",
      "swap:products_gamer<->products_gamer_tmp_1700000000000",
      "deleteIndex:products_gamer_tmp_1700000000000",
    ]);
  });

  it("reindex-search a publikus terméket upserteli, a hiányzó/törölt ID-t törli az indexből", async () => {
    const meili = mockAdminClient();
    const result = await runIncrementalReindex(
      { brandId: "gamer", productIds: [101, 202, 101] },
      {
        meili,
        fetcher: {
          fetchAllProducts: vi.fn(),
          fetchProductsByIds: vi.fn().mockResolvedValue([sampleProduct({ id: 101 })]),
        },
        now: () => 1000,
      },
    );

    expect(result).toEqual({
      brandId: "gamer",
      indexUid: "products_gamer",
      upserted: 1,
      deleted: 1,
      durationMs: 0,
    });
    expect(meili.calls).toEqual([
      "ensureIndex:products_gamer",
      "upsert:products_gamer:1",
      "delete:products_gamer:202",
    ]);
  });

  it("reindex-search frissen létrehozott indexnél alkalmazza az index-beállításokat", async () => {
    const meili = mockAdminClient(true);
    await runIncrementalReindex(
      { brandId: "gamer", productIds: [101] },
      {
        meili,
        fetcher: {
          fetchAllProducts: vi.fn(),
          fetchProductsByIds: vi.fn().mockResolvedValue([sampleProduct({ id: 101 })]),
        },
        now: () => 1000,
      },
    );

    expect(meili.calls).toEqual([
      "ensureIndex:products_gamer",
      "applySettings:products_gamer",
      "upsert:products_gamer:1",
    ]);
  });

  it("ensureBrandSearchKey idempotensen újrahasznosítja a meglévő index-korlátozott kulcsot", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          results: [
            {
              key: "search-key-gamer",
              uid: "uid-1",
              name: "kg-search-gamer",
              actions: ["search"],
              indexes: ["products_gamer"],
              expiresAt: null,
            },
          ],
        }),
        { status: 200, headers: { "Content-Type": "application/json" } },
      ),
    );
    const client = createMeilisearchAdminClient({
      host: "http://127.0.0.1:7700",
      masterKey: "master",
      fetchImpl: fetchMock,
    });

    const key = await client.ensureBrandSearchKey(gamerBrand);
    expect(key.key).toBe("search-key-gamer");
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});
