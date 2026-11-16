import type { MoneyParts } from "@/shared/lib/format";

export const rarities = ["common", "rare", "epic", "legendary"] as const;
export type Rarity = (typeof rarities)[number];

export type StockStatus = "in_stock" | "low_stock" | "backorder" | "out_of_stock";

export type ProductPrice = {
  current: MoneyParts;
  regular: MoneyParts;
  onSale: boolean;
  /** Omnibus: az akció előtti 30 nap legalacsonyabb ára (a Woo számolja), ha elérhető. */
  lowest30Days: MoneyParts | null;
};

export type ProductImage = { src: string; alt: string };

export type ProductVariationAttribute = {
  name: string;
  taxonomy: string;
  value: string;
  slug: string;
};

export type ProductVariation = {
  id: number;
  sku: string;
  attributes: ProductVariationAttribute[];
  price: ProductPrice;
  stockStatus: StockStatus;
  inStock: boolean;
  onBackorder: boolean;
  purchasable: boolean;
  lowStockRemaining: number | null;
  deliveryTime: string | null;
  image: ProductImage | null;
};

export type ProductAttributeOption = {
  id: number;
  name: string;
  slug: string;
};

export type ProductAttribute = {
  id: number;
  name: string;
  taxonomy: string;
  hasVariations: boolean;
  terms: ProductAttributeOption[];
};

export type CatalogFilterAttribute = {
  id: number;
  name: string;
  taxonomy: string;
  terms: Array<{ id: number; name: string; slug: string; count: number }>;
};

export type Product = {
  id: number;
  slug: string;
  type: string;
  name: string;
  sku: string;
  summary: string[];
  description: string[];
  image: ProductImage | null;
  images: ProductImage[];
  categories: { id: number; name: string; slug: string }[];
  attributes: ProductAttribute[];
  variations: ProductVariation[];
  price: ProductPrice;
  stockStatus: StockStatus;
  inStock: boolean;
  onBackorder: boolean;
  purchasable: boolean;
  lowStockRemaining: number | null;
  deliveryTime: string | null;
  rarity: Rarity;
};

export type ProductPageResult = {
  products: Product[];
  total: number;
  totalPages: number;
};
