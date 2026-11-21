import { WooError } from "@kg/woo-client";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  getCategories: vi.fn(),
  getCategoryBySlug: vi.fn(),
  getCatalogAttributes: vi.fn(),
  getProductsPage: vi.fn(),
}));

vi.mock("@/entities/category/index.server", () => ({
  getCategories: mocks.getCategories,
  getCategoryBySlug: mocks.getCategoryBySlug,
}));
vi.mock("@/entities/product/index.server", () => ({
  getCatalogAttributes: mocks.getCatalogAttributes,
  getProductsPage: mocks.getProductsPage,
  getStoreMinorUnit: vi.fn().mockResolvedValue(0),
}));

import { generateCatalogMetadata } from "./catalog-page";

const keyboards = { id: 1, slug: "billentyuzet", name: "Billentyűzetek" };
const props = (slug?: string, searchParams = {}) => ({
  params: Promise.resolve({ brand: "gamer", slug }),
  searchParams: Promise.resolve(searchParams),
});

describe("generateCatalogMetadata", () => {
  beforeEach(() => {
    mocks.getCategories.mockReset().mockResolvedValue([keyboards]);
    mocks.getCategoryBySlug.mockReset().mockResolvedValue(keyboards);
    mocks.getCatalogAttributes.mockReset().mockResolvedValue([]);
    mocks.getProductsPage.mockReset().mockResolvedValue({ products: [], total: 0, totalPages: 0 });
  });

  it("a kategóriák Woo-hibájánál noindex", async () => {
    mocks.getCategories.mockRejectedValue(new WooError("WOO.UNAVAILABLE", "down"));
    expect(await generateCatalogMetadata(props())).toMatchObject({ robots: { index: false } });
  });

  it("cache-elt kategóriák mellett a termék-lekérdezés Woo-hibájánál is noindex", async () => {
    mocks.getProductsPage.mockRejectedValue(new WooError("WOO.UNAVAILABLE", "down"));
    expect(
      await generateCatalogMetadata(props("billentyuzet", { min_price: "1234" })),
    ).toMatchObject({ robots: { index: false } });
  });

  it("elérhető Woo mellett a kategória nevét adja, indexelhető", async () => {
    expect(await generateCatalogMetadata(props("billentyuzet"))).toEqual({
      title: "Billentyűzetek",
    });
  });
});
