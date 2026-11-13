import "server-only";

import type { Brand } from "@kg/brand-config";
import type { ProductQuery } from "@kg/woo-client";

import { cacheTags, getStoreClient } from "@/shared/api/index.server";

import { mapProduct } from "../lib/map-product";
import type { Product } from "../model/types";

/** A katalógus ISR-rel frissül; a pontos frissítést később a Woo webhook adja (`revalidateTag`). */
const REVALIDATE_SECONDS = 300;

export async function getProducts(brand: Brand, query: ProductQuery = {}): Promise<Product[]> {
  const products = await getStoreClient(brand).getProducts(query, {
    revalidate: REVALIDATE_SECONDS,
    tags: [cacheTags.products(brand.id)],
  });
  return products.map((product) => mapProduct(product, brand));
}

export async function getProduct(brand: Brand, slug: string): Promise<Product | null> {
  const product = await getStoreClient(brand).getProductBySlug(slug, {
    revalidate: REVALIDATE_SECONDS,
    tags: [cacheTags.products(brand.id), cacheTags.product(brand.id, slug)],
  });
  return product ? mapProduct(product, brand) : null;
}
