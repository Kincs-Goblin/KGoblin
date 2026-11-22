import type { Brand } from "@kg/brand-config";

import { getCategories } from "@/entities/category/index.server";
import { getAllProductsForSitemap } from "@/entities/product/index.server";
import { routes } from "@/shared/config";
import { buildCanonicalUrl, type SitemapEntry } from "@/shared/lib/seo";

/** Jogi oldalak listája; a KG-19 bekötésekor ide kerülnek a statikus útvonalak. */
const LEGAL_PATHS: readonly string[] = [];

export type BrandSitemapResult = {
  entries: SitemapEntry[];
  /** `true`, ha a kategóriák vagy termékek lekérése elbukott (ilyenkor a CDN nem cache-elheti a csonka választ). */
  partial: boolean;
};

/**
 * Egy brand összes publikus, indexelhető URL-je a sitemap.xml-hez.
 * Woo-hiba esetén legalább a statikus útvonalak visszaadódnak, de `partial: true` jelzéssel.
 */
export async function buildBrandSitemapEntries(brand: Brand): Promise<BrandSitemapResult> {
  const entries: SitemapEntry[] = [
    { loc: buildCanonicalUrl(brand, routes.home) },
    { loc: buildCanonicalUrl(brand, routes.products) },
    ...LEGAL_PATHS.map((path) => ({ loc: buildCanonicalUrl(brand, path) })),
  ];

  const [categoriesResult, productsResult] = await Promise.allSettled([
    getCategories(brand),
    getAllProductsForSitemap(brand),
  ]);

  let partial = false;
  if (categoriesResult.status === "fulfilled") {
    for (const category of categoriesResult.value) {
      entries.push({ loc: buildCanonicalUrl(brand, routes.category(category.slug)) });
    }
  } else {
    partial = true;
  }

  if (productsResult.status === "fulfilled") {
    for (const product of productsResult.value) {
      entries.push({
        loc: buildCanonicalUrl(brand, routes.product(product.slug)),
        lastmod: product.updatedAt,
      });
    }
  } else {
    partial = true;
  }

  return { entries, partial };
}
