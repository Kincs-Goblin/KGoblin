import "server-only";

import type { Brand } from "@kg/brand-config";

import { cacheTags, getStoreClient } from "@/shared/api/index.server";
import { decodeEntities, htmlToParagraphs } from "@/shared/lib/html";

import type { Category } from "../model/types";

const REVALIDATE_SECONDS = 600;

/** A nem üres kategóriák, név szerint rendezve. */
export async function getCategories(brand: Brand): Promise<Category[]> {
  const categories = await getStoreClient(brand).getCategories({
    revalidate: REVALIDATE_SECONDS,
    tags: [cacheTags.categories(brand.id)],
  });
  return categories
    .filter((category) => category.count > 0)
    .map((category) => ({
      id: category.id,
      name: decodeEntities(category.name),
      slug: category.slug,
      description: htmlToParagraphs(category.description).join(" "),
      productCount: category.count,
      parentId: category.parent,
    }))
    .sort((a, b) => a.name.localeCompare(b.name, "hu"));
}

export async function getCategoryBySlug(brand: Brand, slug: string): Promise<Category | null> {
  const categories = await getCategories(brand);
  return categories.find((category) => category.slug === slug) ?? null;
}
