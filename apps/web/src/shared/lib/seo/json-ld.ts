import { getBrandCanonicalOrigin, type Brand } from "@kg/brand-config";

import { buildCanonicalUrl } from "./metadata";

/** XSS-biztos JSON-LD szerializálás (`</script>` injekció ellen). */
export function serializeJsonLd(data: Record<string, unknown>): string {
  return JSON.stringify(data).replace(/</g, "\\u003c");
}

/**
 * Minor unit egész string -> pontos decimális ár string float-kerekítés nélkül.
 * Pl. ("16990", 0) -> "16990", ("1299", 2) -> "12.99".
 */
export function minorUnitToDecimalString(minorAmount: string, minorUnit: number): string {
  const digits = minorAmount.trim();
  if (!/^\d+$/.test(digits)) return "0";
  if (minorUnit <= 0) return String(BigInt(digits));
  const padded = digits.padStart(minorUnit + 1, "0");
  const whole = String(BigInt(padded.slice(0, -minorUnit)));
  const fraction = padded.slice(-minorUnit);
  return `${whole}.${fraction}`;
}

export function buildOrganizationJsonLd(brand: Brand): Record<string, unknown> {
  const origin = getBrandCanonicalOrigin(brand);
  return {
    "@context": "https://schema.org",
    "@type": "Organization",
    name: brand.name,
    url: `${origin}/`,
    description: brand.texts.defaultDescription,
  };
}

export function buildWebSiteJsonLd(brand: Brand): Record<string, unknown> {
  const origin = getBrandCanonicalOrigin(brand);
  return {
    "@context": "https://schema.org",
    "@type": "WebSite",
    name: brand.name,
    url: `${origin}/`,
    potentialAction: {
      "@type": "SearchAction",
      target: {
        "@type": "EntryPoint",
        urlTemplate: `${origin}/kereses?q={search_term_string}`,
      },
      "query-input": "required name=search_term_string",
    },
  };
}

export type BreadcrumbItem = {
  name: string;
  path: string;
};

export function buildBreadcrumbJsonLd(
  brand: Brand,
  items: readonly BreadcrumbItem[],
): Record<string, unknown> {
  return {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: items.map((item, index) => ({
      "@type": "ListItem",
      position: index + 1,
      name: item.name,
      item: buildCanonicalUrl(brand, item.path),
    })),
  };
}

export type ProductJsonLdInput = {
  brand: Brand;
  product: {
    name: string;
    slug: string;
    sku: string;
    gtin?: string | null;
    description: string;
    images: readonly string[];
    priceMinorAmount: string;
    currency: string;
    minorUnit: number;
    stockStatus: "in_stock" | "low_stock" | "backorder" | "out_of_stock";
    rating?: { value: number; count: number } | null;
  };
};

function mapAvailability(status: ProductJsonLdInput["product"]["stockStatus"]): string {
  switch (status) {
    case "in_stock":
    case "low_stock":
      return "https://schema.org/InStock";
    case "backorder":
      return "https://schema.org/PreOrder";
    case "out_of_stock":
      return "https://schema.org/OutOfStock";
  }
}

function resolveGtinField(rawGtin: string | null | undefined): Record<string, string> {
  if (!rawGtin) return {};
  const digits = rawGtin.replace(/[\s-]+/g, "");
  if (!/^\d+$/.test(digits)) return {};
  if (digits.length === 13) return { gtin13: digits };
  if (digits.length === 8) return { gtin8: digits };
  if (digits.length === 12) return { gtin12: digits };
  if (digits.length === 14) return { gtin14: digits };
  return {};
}

export function buildProductJsonLd({
  brand,
  product,
}: ProductJsonLdInput): Record<string, unknown> {
  const url = buildCanonicalUrl(brand, `/termek/${product.slug}`);
  const gtinFields = resolveGtinField(product.gtin);

  return {
    "@context": "https://schema.org",
    "@type": "Product",
    name: product.name,
    description: product.description || brand.texts.defaultDescription,
    url,
    ...(product.images.length > 0 ? { image: [...product.images] } : {}),
    ...(product.sku ? { sku: product.sku } : {}),
    ...gtinFields,
    brand: {
      "@type": "Brand",
      name: brand.name,
    },
    offers: {
      "@type": "Offer",
      url,
      priceCurrency: product.currency,
      price: minorUnitToDecimalString(product.priceMinorAmount, product.minorUnit),
      availability: mapAvailability(product.stockStatus),
      itemCondition: "https://schema.org/NewCondition",
    },
    ...(product.rating && product.rating.count > 0 && product.rating.value > 0
      ? {
          aggregateRating: {
            "@type": "AggregateRating",
            ratingValue: product.rating.value,
            reviewCount: product.rating.count,
          },
        }
      : {}),
  };
}
