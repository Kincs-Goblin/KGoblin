/**
 * Cache-tagek egy helyen, mindig brand-előtaggal (`<brand>:...`), a webhook-revalidálás is ezeket használja.
 * Egyedi termék-ID szerinti bontás és debounce a KG-14 feed-szinkron follow-upban készül.
 */
export const cacheTags = {
  catalog: (brandId: string) => `${brandId}:catalog`,
  productSlug: (brandId: string, slug: string) => `${brandId}:product-slug:${slug}`,
  category: (brandId: string, id: number) => `${brandId}:category:${id}`,
} as const;
