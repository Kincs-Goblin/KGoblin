import { getBrandCanonicalOrigin, type Brand } from "@kg/brand-config";
import type { Metadata } from "next";

import { isIndexableEnv } from "./env";

export type PageMetadataInput = {
  brand: Brand;
  title?: string;
  description?: string;
  /** Látható útvonal a brand domainjén (pl. `/`, `/termekek`, `/termek/pelda`), query paraméter nélkül. */
  canonicalPath: string;
  ogType?: "website" | "article";
  ogImage?: {
    url: string;
    alt: string;
    width?: number;
    height?: number;
  };
  /** Kifejezett noindex (pl. keresési találati oldal vagy nem létező erőforrás). */
  noIndex?: boolean;
  /** Opcionális környezet-felülírás tesztekhez. */
  appEnv?: string;
};

/**
 * Kanonikus abszolút URL a brand elsődleges domainjén.
 * A query paramétereket és a fragmentet szándékosan eldobja (szűrt lista -> szűretlen canonical).
 */
export function buildCanonicalUrl(brand: Brand, pathname: string): string {
  const origin = getBrandCanonicalOrigin(brand);
  const cleanPath = pathname.split(/[?#]/, 1)[0] || "/";
  const normalizedPath = cleanPath.startsWith("/") ? cleanPath : `/${cleanPath}`;
  if (normalizedPath === "/") return `${origin}/`;
  return `${origin}${normalizedPath.replace(/\/+$/, "")}`;
}

export function buildPageMetadata(input: PageMetadataInput): Metadata {
  const { brand, title, canonicalPath, ogType = "website", ogImage, noIndex = false } = input;
  const description = input.description?.trim() || brand.texts.defaultDescription;
  const canonical = buildCanonicalUrl(brand, canonicalPath);
  const fullTitle = title
    ? brand.texts.titleTemplate.replace("%s", title)
    : `${brand.name} - ${brand.texts.tagline}`;
  const indexable = isIndexableEnv(input.appEnv) && !noIndex;

  return {
    ...(title ? { title } : {}),
    description,
    alternates: {
      canonical,
    },
    robots: indexable ? { index: true, follow: true } : { index: false, follow: false },
    openGraph: {
      type: ogType,
      locale: brand.locale.replace("-", "_"),
      siteName: brand.name,
      title: fullTitle,
      description,
      url: canonical,
      ...(ogImage
        ? {
            images: [
              {
                url: ogImage.url,
                alt: ogImage.alt,
                width: ogImage.width ?? 1200,
                height: ogImage.height ?? 630,
              },
            ],
          }
        : {}),
    },
    twitter: {
      card: "summary_large_image",
      title: fullTitle,
      description,
      ...(ogImage ? { images: [ogImage.url] } : {}),
    },
  };
}
