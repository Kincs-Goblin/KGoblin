/** Cache-tagek egy helyen, mindig brand-előtaggal (`<brand>:...`), a webhook-revalidálás is ezeket használja. */
export const cacheTags = {
  catalog: (brandId: string) => `${brandId}:catalog`,
  product: (brandId: string, id: number) => `${brandId}:product:${id}`,
  productSlug: (brandId: string, slug: string) => `${brandId}:product-slug:${slug}`,
  category: (brandId: string, id: number) => `${brandId}:category:${id}`,
} as const;
