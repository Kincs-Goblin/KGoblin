import { isWooError } from "@kg/woo-client";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound, permanentRedirect } from "next/navigation";
import { cache } from "react";

import { getProduct, resolveProductSlugRedirect } from "@/entities/product/index.server";
import { routes } from "@/shared/config";
import { getBrandOrNotFound } from "@/shared/config/index.server";
import {
  JsonLd,
  buildBreadcrumbJsonLd,
  buildCanonicalUrl,
  buildPageMetadata,
  buildProductJsonLd,
} from "@/shared/lib/seo";
import { ErrorState } from "@/shared/ui/error-state";

import { productPageTexts } from "../config/texts";
import { ProductDetails } from "./product-details";

type ProductPageProps = {
  params: Promise<{ brand: string; slug: string }>;
};

/** Kérésenként egyszer (metadata + oldal); a Woo-fetchek `AbortSignal` miatt nem memoizáltak. */
const loadProduct = cache(async (brandId: string, slug: string) => {
  try {
    return { ok: true as const, product: await getProduct(getBrandOrNotFound(brandId), slug) };
  } catch (error) {
    if (isWooError(error)) return { ok: false as const, code: error.code };
    throw error;
  }
});

export async function generateProductMetadata({ params }: ProductPageProps): Promise<Metadata> {
  const { brand: brandId, slug } = await params;
  const brand = getBrandOrNotFound(brandId);
  const result = await loadProduct(brandId, slug);
  // A dinamikus oldal Woo-hibánál 200-as hibaállapotot renderel; a metadata a `<head>`-be kerül, így nem indexelhető.
  if (!result.ok) {
    return { robots: { index: false } };
  }
  if (!result.product) {
    return { robots: { index: false, follow: false } };
  }

  const productPath = routes.product(result.product.slug);
  return buildPageMetadata({
    brand,
    title: result.product.name,
    description: result.product.summary.join(" ").slice(0, 160) || brand.texts.defaultDescription,
    canonicalPath: productPath,
    ogImage: {
      url: buildCanonicalUrl(brand, `${productPath}/opengraph-image`),
      alt: result.product.name,
    },
  });
}

export async function ProductPage({ params }: ProductPageProps) {
  const { brand: brandId, slug } = await params;
  const brand = getBrandOrNotFound(brandId);
  const result = await loadProduct(brandId, slug);

  if (!result.ok) {
    return (
      <section className="mx-auto max-w-7xl px-4 py-16 sm:px-6">
        <ErrorState code={result.code} title={productPageTexts.errorTitle} />
      </section>
    );
  }
  if (!result.product) {
    const targetSlug = await resolveProductSlugRedirect(brand, slug);
    if (targetSlug && targetSlug !== slug) {
      permanentRedirect(routes.product(targetSlug));
    }
    notFound();
  }

  const product = result.product;
  const category = product.categories[0];
  const breadcrumbItems = [
    { name: productPageTexts.breadcrumbHome, path: routes.home },
    ...(category ? [{ name: category.name, path: routes.category(category.slug) }] : []),
    { name: product.name, path: routes.product(product.slug) },
  ];

  return (
    <article className="mx-auto max-w-7xl px-4 py-8 sm:px-6 sm:py-10">
      <JsonLd data={buildBreadcrumbJsonLd(brand, breadcrumbItems)} />
      <JsonLd
        data={buildProductJsonLd({
          brand,
          product: {
            name: product.name,
            slug: product.slug,
            sku: product.sku,
            gtin: product.gtin,
            description: product.summary.join(" ") || product.description.join(" "),
            images: product.images.map((image) => image.src),
            priceMinorAmount: product.price.current.amount,
            currency: product.price.current.currency,
            minorUnit: product.price.current.minorUnit,
            stockStatus: product.stockStatus,
            rating: product.rating,
          },
        })}
      />
      <nav aria-label={productPageTexts.breadcrumbLabel} className="text-sm text-muted-foreground">
        <Link href={routes.home} className="hover:text-gold">
          {productPageTexts.breadcrumbHome}
        </Link>
        {category ? (
          <>
            <span aria-hidden="true"> / </span>
            <Link href={routes.category(category.slug)} className="hover:text-gold">
              {category.name}
            </Link>
          </>
        ) : null}
        <span aria-hidden="true"> / </span>
        <span aria-current="page">{product.name}</span>
      </nav>

      <ProductDetails product={product} />
    </article>
  );
}
