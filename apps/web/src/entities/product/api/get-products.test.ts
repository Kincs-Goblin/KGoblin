import { brands } from "@kg/brand-config";
import { fixtureProducts } from "@kg/woo-client/fixtures";
import { beforeEach, describe, expect, it, vi } from "vitest";

const getProductsPageMock = vi.fn();

vi.mock("server-only", () => ({}));
vi.mock("@/shared/api/index.server", () => ({
  cacheTags: {
    catalog: (brandId: string) => `${brandId}:catalog`,
    category: (brandId: string, categoryId: number) => `${brandId}:category:${categoryId}`,
    productSlug: (brandId: string, slug: string) => `${brandId}:product-slug:${slug}`,
  },
  getStoreClient: () => ({
    getProductsPage: getProductsPageMock,
  }),
}));

import { getStoreMinorUnit } from "./get-products";

const gamerBrand = brands[0]!;

describe("getStoreMinorUnit", () => {
  beforeEach(() => {
    getProductsPageMock.mockReset();
  });

  it("a Store API prices.currency_minor_unit értékét adja vissza (még ha a brand HUF alapból 0 is)", async () => {
    const twoDecimalHufProduct = {
      ...structuredClone(fixtureProducts[0]!),
      prices: {
        ...fixtureProducts[0]!.prices,
        currency_code: "HUF",
        currency_minor_unit: 2,
      },
    };
    getProductsPageMock.mockResolvedValue({
      products: [twoDecimalHufProduct],
      total: 1,
      totalPages: 1,
    });

    await expect(getStoreMinorUnit(gamerBrand)).resolves.toBe(2);
    expect(getProductsPageMock).toHaveBeenCalledWith(
      { perPage: 1 },
      { revalidate: 300, tags: ["gamer:catalog"] },
    );
  });

  it("üres katalógusnál a brand pénzneméből számolt alapértékre esik vissza", async () => {
    getProductsPageMock.mockResolvedValue({
      products: [],
      total: 0,
      totalPages: 1,
    });

    await expect(getStoreMinorUnit(gamerBrand)).resolves.toBe(0);
  });
});
