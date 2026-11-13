import type { Brand } from "@kg/brand-config";
import type { StoreProduct } from "@kg/woo-client";

import { decodeEntities, htmlToParagraphs } from "@/shared/lib/html";

import type { Product } from "../model/types";
import { resolveRarity } from "./rarity";

/** Store API-termék → a felület modellje. Árat nem számol, csak átveszi a Woo értékeit. */
export function mapProduct(raw: StoreProduct, brand: Brand): Product {
  const { prices } = raw;
  const money = (amount: string) => ({
    amount,
    currency: prices.currency_code,
    minorUnit: prices.currency_minor_unit,
  });
  const lowest = raw.extensions.kg_headless?.lowest_price_30_days;
  const name = decodeEntities(raw.name);
  const images = raw.images.map((image) => ({ src: image.src, alt: image.alt || name }));

  return {
    id: raw.id,
    slug: raw.slug,
    name,
    sku: raw.sku,
    summary: htmlToParagraphs(raw.short_description),
    description: htmlToParagraphs(raw.description),
    image: images[0] ?? null,
    images,
    categories: raw.categories.map((category) => ({
      id: category.id,
      name: decodeEntities(category.name),
      slug: category.slug,
    })),
    price: {
      current: money(prices.price),
      regular: money(prices.regular_price),
      onSale: raw.on_sale,
      lowest30Days: raw.on_sale && lowest != null ? money(String(lowest)) : null,
    },
    inStock: raw.is_in_stock,
    purchasable: raw.is_purchasable,
    lowStockRemaining: raw.low_stock_remaining,
    rarity: resolveRarity(
      raw.tags.map((tag) => tag.slug),
      Number(prices.regular_price),
      brand.merchandising.rarityThresholds,
    ),
  };
}
