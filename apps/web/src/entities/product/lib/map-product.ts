import type { Brand } from "@kg/brand-config";
import type { StorePrice, StoreProduct } from "@kg/woo-client";

import { decodeEntities, htmlToParagraphs } from "@/shared/lib/html";

import type { Product, ProductVariation, StockStatus } from "../model/types";
import { resolveRarity } from "./rarity";

export function resolveStockStatus(input: {
  inStock: boolean;
  onBackorder: boolean;
  lowStockRemaining: number | null;
}): StockStatus {
  if (input.onBackorder) return "backorder";
  if (!input.inStock) return "out_of_stock";
  if (input.lowStockRemaining != null && input.lowStockRemaining > 0) return "low_stock";
  return "in_stock";
}

function mapPrice(prices: StorePrice, onSale: boolean, lowest30Days: number | null | undefined) {
  const money = (amount: string) => ({
    amount,
    currency: prices.currency_code,
    minorUnit: prices.currency_minor_unit,
  });

  return {
    current: money(prices.price),
    regular: money(prices.regular_price),
    onSale,
    lowest30Days: onSale && lowest30Days != null ? money(String(lowest30Days)) : null,
  };
}

/** Store API-termék → a felület modellje. Árat nem számol, csak átveszi a Woo értékeit. */
export function mapProduct(raw: StoreProduct, brand: Brand): Product {
  const name = decodeEntities(raw.name);
  const images = raw.images.map((image) => ({
    src: image.src,
    alt: decodeEntities(image.alt || name),
  }));
  const extension = raw.extensions.kg_headless;
  const parentDeliveryTime = extension?.delivery_time ?? null;

  const variations: ProductVariation[] = (extension?.variations ?? []).map((variation) => {
    const stockStatus = resolveStockStatus({
      inStock: variation.is_in_stock,
      onBackorder: variation.is_on_backorder,
      lowStockRemaining: variation.low_stock_remaining,
    });
    return {
      id: variation.id,
      sku: variation.sku,
      attributes: variation.attributes.map((attr) => ({
        name: decodeEntities(attr.name),
        taxonomy: attr.taxonomy,
        value: decodeEntities(attr.value),
        slug: attr.slug,
      })),
      price: mapPrice(variation.prices, variation.on_sale, variation.lowest_price_30_days),
      stockStatus,
      inStock: variation.is_in_stock,
      onBackorder: variation.is_on_backorder,
      purchasable: variation.is_purchasable,
      lowStockRemaining: variation.low_stock_remaining,
      deliveryTime: variation.delivery_time ?? (variation.is_in_stock ? parentDeliveryTime : null),
      image: variation.image
        ? {
            src: variation.image.src,
            alt: decodeEntities(variation.image.alt || name),
          }
        : null,
    };
  });

  const stockStatus = resolveStockStatus({
    inStock: raw.is_in_stock,
    onBackorder: raw.is_on_backorder,
    lowStockRemaining: raw.low_stock_remaining,
  });

  return {
    id: raw.id,
    slug: raw.slug,
    type: raw.type,
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
    attributes: raw.attributes.map((attribute) => ({
      id: attribute.id,
      name: decodeEntities(attribute.name),
      taxonomy: attribute.taxonomy,
      hasVariations: attribute.has_variations,
      terms: attribute.terms.map((term) => ({
        id: term.id,
        name: decodeEntities(term.name),
        slug: term.slug,
      })),
    })),
    variations,
    price: mapPrice(raw.prices, raw.on_sale, extension?.lowest_price_30_days),
    stockStatus,
    inStock: raw.is_in_stock,
    onBackorder: raw.is_on_backorder,
    purchasable: raw.is_purchasable,
    lowStockRemaining: raw.low_stock_remaining,
    deliveryTime: parentDeliveryTime,
    rarity: resolveRarity(
      raw.tags.map((tag) => tag.slug),
      Number(raw.prices.regular_price),
      brand.merchandising.rarityThresholds,
    ),
    locale: brand.locale,
  };
}
