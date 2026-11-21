import { isWooError } from "@kg/woo-client";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { cache } from "react";

import { getProduct } from "@/entities/product/index.server";
import { routes } from "@/shared/config";
import { getBrandOrNotFound } from "@/shared/config/index.server";
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
  const { brand, slug } = await params;
  const result = await loadProduct(brand, slug);
  // A dinamikus oldal Woo-hibánál 200-as hibaállapotot renderel; a metadata a `<head>`-be kerül, így nem indexelhető.
  if (!result.ok) return { robots: { index: false } };
  const product = result.product;
  return product
    ? { title: product.name, description: product.summary.join(" ").slice(0, 160) }
    : {};
}

export async function ProductPage({ params }: ProductPageProps) {
  const { brand, slug } = await params;
  const result = await loadProduct(brand, slug);

  if (!result.ok) {
    return (
      <section className="mx-auto max-w-7xl px-4 py-16 sm:px-6">
        <ErrorState code={result.code} title={productPageTexts.errorTitle} />
      </section>
    );
  }
  if (!result.product) notFound();

  const category = result.product.categories[0];

  return (
    <article className="mx-auto max-w-7xl px-4 py-8 sm:px-6 sm:py-10">
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
        <span aria-current="page">{result.product.name}</span>
      </nav>

      <ProductDetails product={result.product} />
    </article>
  );
}
