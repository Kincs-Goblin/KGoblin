/** Cache-tagek egy helyen, mindig brand-előtaggal (a webhook-revalidálás is ezeket használja). */
export const cacheTags = {
  products: (brandId: string) => `products:${brandId}`,
  product: (brandId: string, slug: string) => `product:${brandId}:${slug}`,
  categories: (brandId: string) => `categories:${brandId}`,
} as const;
