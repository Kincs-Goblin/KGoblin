/** Útvonal-konstansok; a brand-előtagot a proxy kezeli, itt a látható URL szerepel. */
export const routes = {
  home: "/",
  products: "/termekek",
  search: "/kereses",
  cart: "/kosar",
  category: (slug: string) => `/kategoria/${slug}`,
  product: (slug: string) => `/termek/${slug}`,
} as const;
