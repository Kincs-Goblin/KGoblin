import "server-only";

import type { Brand } from "@kg/brand-config";
import type { ProductQuery } from "@kg/woo-client";

import { cacheTags, getStoreClient } from "@/shared/api/index.server";
import { getCurrencyMinorUnit } from "@/shared/lib/format";
import { decodeEntities } from "@/shared/lib/html";

import { mapProduct } from "../lib/map-product";
import type { CatalogFilterAttribute, Product, ProductPageResult } from "../model/types";

/** A katalógus ISR-rel frissül; az azonnali frissítést a Woo webhook adja (`revalidateTag`). */
const REVALIDATE_SECONDS = 300;

export async function getStoreMinorUnit(brand: Brand): Promise<number> {
  const page = await getStoreClient(brand).getProductsPage(
    { perPage: 1 },
    {
      revalidate: REVALIDATE_SECONDS,
      tags: [cacheTags.catalog(brand.id)],
    },
  );
  return page.products[0]?.prices.currency_minor_unit ?? getCurrencyMinorUnit(brand.currency);
}

export async function getProductsPage(
  brand: Brand,
  query: ProductQuery = {},
): Promise<ProductPageResult> {
  const tags = [cacheTags.catalog(brand.id)];
  if (query.category) {
    const categoryId = Number(query.category);
    if (Number.isInteger(categoryId) && categoryId > 0) {
      tags.push(cacheTags.category(brand.id, categoryId));
    }
  }
  const page = await getStoreClient(brand).getProductsPage(query, {
    revalidate: REVALIDATE_SECONDS,
    tags,
  });
  return {
    products: page.products.map((product) => mapProduct(product, brand)),
    total: page.total,
    totalPages: page.totalPages,
  };
}

export async function getProducts(brand: Brand, query: ProductQuery = {}): Promise<Product[]> {
  return (await getProductsPage(brand, query)).products;
}

export async function getProduct(brand: Brand, slug: string): Promise<Product | null> {
  const product = await getStoreClient(brand).getProductBySlug(slug, {
    revalidate: REVALIDATE_SECONDS,
    tags: [cacheTags.catalog(brand.id), cacheTags.productSlug(brand.id, slug)],
  });
  return product ? mapProduct(product, brand) : null;
}

export async function resolveProductSlugRedirect(
  brand: Brand,
  slug: string,
): Promise<string | null> {
  return getStoreClient(brand).resolveSlugRedirect("product", slug, {
    revalidate: REVALIDATE_SECONDS,
    tags: [cacheTags.catalog(brand.id), cacheTags.productSlug(brand.id, slug)],
  });
}

const SITEMAP_PAGE_CONCURRENCY = 4;

/** Sitemap-generáláshoz végiglapozza a brand publikált termékeit (100-as oldalanként, korlátozott párhuzamossággal). */
export async function getAllProductsForSitemap(brand: Brand): Promise<Product[]> {
  const first = await getProductsPage(brand, { page: 1, perPage: 100 });
  if (first.totalPages <= 1) return first.products;

  const products = [...first.products];
  for (let start = 2; start <= first.totalPages; start += SITEMAP_PAGE_CONCURRENCY) {
    const end = Math.min(start + SITEMAP_PAGE_CONCURRENCY - 1, first.totalPages);
    const batchPages = Array.from({ length: end - start + 1 }, (_, i) => start + i);
    const batch = await Promise.all(
      batchPages.map((page) => getProductsPage(brand, { page, perPage: 100 })),
    );
    for (const result of batch) {
      products.push(...result.products);
    }
  }
  return products;
}

export async function getCatalogAttributes(brand: Brand): Promise<CatalogFilterAttribute[]> {
  const client = getStoreClient(brand);
  const cache = {
    revalidate: REVALIDATE_SECONDS,
    tags: [cacheTags.catalog(brand.id)],
  };
  const attributes = await client.getAttributes(cache);
  const termsByAttribute = await Promise.all(
    attributes.map((attribute) => client.getAttributeTerms(attribute.id, cache)),
  );

  return attributes
    .map((attribute, index) => ({
      id: attribute.id,
      name: decodeEntities(attribute.name),
      taxonomy: attribute.taxonomy,
      terms: (termsByAttribute[index] ?? [])
        .filter((term) => term.count > 0)
        .map((term) => ({
          id: term.id,
          name: decodeEntities(term.name),
          slug: term.slug,
          count: term.count,
        })),
    }))
    .filter((attribute) => Boolean(attribute.taxonomy) && attribute.terms.length > 0);
}
