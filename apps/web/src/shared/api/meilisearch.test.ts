import { brands } from "@kg/brand-config";
import { describe, expect, it, vi } from "vitest";

import { getBrandSearchConfig, searchProducts } from "./meilisearch";

const gamerBrand = brands[0]!;

describe("Meilisearch BFF kliens (KG-50)", () => {
  it("getBrandSearchConfig csak a brand search-only kulcsát olvassa, master kulcsot soha", () => {
    expect(
      getBrandSearchConfig(gamerBrand, {
        MEILISEARCH_URL: "http://127.0.0.1:7700",
        MEILISEARCH_MASTER_KEY: "should-never-be-used",
      }),
    ).toBeNull();

    expect(
      getBrandSearchConfig(gamerBrand, {
        MEILISEARCH_URL: "http://127.0.0.1:7700/",
        MEILISEARCH_GAMER_SEARCH_KEY: "search-only-key",
      }),
    ).toEqual({
      host: "http://127.0.0.1:7700",
      searchKey: "search-only-key",
      indexUid: "products_gamer",
    });
  });

  it("élő módban a brand indexét hívja brandId szűrővel és search-only kulccsal", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          hits: [
            {
              id: 101,
              brandId: "gamer",
              name: "Rúnakard TKL Pro",
              slug: "runakard-tkl-pro",
              sku: "RK-1",
              shortDescription: "Billentyűzet",
              priceMinor: 36990,
              regularPriceMinor: 44990,
              currency: "HUF",
              minorUnit: 0,
              onSale: true,
              inStock: true,
              stockStatus: "in_stock",
              categories: ["Billentyűzetek"],
              categorySlugs: ["billentyuzet"],
              imageUrl: null,
              imageAlt: "Rúnakard",
              popularity: 12,
              _formatted: { name: "<mark>Rúnakard</mark> TKL Pro" },
            },
          ],
          totalHits: 1,
          page: 1,
          totalPages: 1,
          hitsPerPage: 6,
          facetDistribution: {
            categorySlugs: { billentyuzet: 1 },
            inStock: { true: 1 },
            onSale: { true: 1 },
          },
        }),
        { status: 200, headers: { "Content-Type": "application/json" } },
      ),
    );

    const res = await searchProducts(
      gamerBrand,
      { q: "Rúnakard", inStock: true, perPage: 6 },
      {
        env: {
          MEILISEARCH_URL: "http://127.0.0.1:7700",
          MEILISEARCH_GAMER_SEARCH_KEY: "search-only-gamer",
        },
        fetchImpl: fetchMock,
      },
    );

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe("http://127.0.0.1:7700/indexes/products_gamer/search");
    expect((init.headers as Record<string, string>).Authorization).toBe("Bearer search-only-gamer");
    const sentBody = JSON.parse(String(init.body)) as { filter: string[] };
    expect(sentBody.filter).toContain('brandId = "gamer"');
    expect(sentBody.filter).toContain("inStock = true");

    expect(res.totalHits).toBe(1);
    expect(res.hits[0]?.highlightedName).toBe("<mark>Rúnakard</mark> TKL Pro");
    expect(res.facets.categorySlugs).toEqual({ billentyuzet: 1 });
  });

  it("fixture módban (KG_STORE_FIXTURES=1) ékezet-függetlenül keres és faceteket ad", async () => {
    const res = await searchProducts(
      gamerBrand,
      { q: "billentyuzet", perPage: 5 },
      { env: { KG_STORE_FIXTURES: "1" } },
    );

    expect(res.totalHits).toBeGreaterThan(0);
    expect(res.hits[0]?.priceMinor).toBeGreaterThan(0);
    expect(res.hits[0]?.currency).toBe("HUF");
  });
});
