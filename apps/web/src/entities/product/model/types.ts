import type { MoneyParts } from "@/shared/lib/format";

export const rarities = ["common", "rare", "epic", "legendary"] as const;
export type Rarity = (typeof rarities)[number];

export type ProductPrice = {
  current: MoneyParts;
  regular: MoneyParts;
  onSale: boolean;
  /** Omnibus: az akció előtti 30 nap legalacsonyabb ára (a Woo számolja), ha elérhető. */
  lowest30Days: MoneyParts | null;
};

export type ProductImage = { src: string; alt: string };

export type Product = {
  id: number;
  slug: string;
  name: string;
  sku: string;
  summary: string[];
  description: string[];
  image: ProductImage | null;
  images: ProductImage[];
  categories: { id: number; name: string; slug: string }[];
  price: ProductPrice;
  inStock: boolean;
  purchasable: boolean;
  lowStockRemaining: number | null;
  rarity: Rarity;
};
