import { isWooError } from "@kg/woo-client";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import {
  ProductArt,
  ProductPrice,
  RarityBadge,
  StockLabel,
  type Product,
} from "@/entities/product";
import { getProduct } from "@/entities/product/index.server";
import { AddToCartButton } from "@/features/add-to-cart";
import { routes } from "@/shared/config";
import { getBrandOrNotFound } from "@/shared/config/index.server";
import { ErrorState } from "@/shared/ui/error-state";
import { Reveal } from "@/shared/ui/motion";

import { productPageTexts } from "../config/texts";

type ProductPageProps = {
  params: Promise<{ brand: string; slug: string }>;
};

async function loadProduct(brandId: string, slug: string) {
  try {
    return { ok: true as const, product: await getProduct(getBrandOrNotFound(brandId), slug) };
  } catch (error) {
    if (isWooError(error)) return { ok: false as const, code: error.code };
    throw error;
  }
}

export async function generateProductMetadata({ params }: ProductPageProps): Promise<Metadata> {
  const { brand, slug } = await params;
  const result = await loadProduct(brand, slug);
  const product = result.ok ? result.product : null;
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

  return <ProductDetails product={result.product} />;
}

function ProductDetails({ product }: { product: Product }) {
  const category = product.categories[0];

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
        <span aria-current="page">{product.name}</span>
      </nav>

      <div className="mt-6 grid gap-8 lg:grid-cols-2 lg:gap-12">
        <Reveal className="frame-gold rounded-2xl p-3">
          <ProductArt
            image={product.image}
            rarity={product.rarity}
            priority
            sizes="(min-width: 1024px) 50vw, 100vw"
          />
        </Reveal>

        <div className="flex flex-col gap-5">
          <RarityBadge rarity={product.rarity} className="self-start" />
          <h1 className="text-engraved text-3xl font-bold text-balance sm:text-4xl">
            {product.name}
          </h1>
          {product.summary.length > 0 ? (
            <div className="space-y-2 text-foreground/85">
              {product.summary.map((paragraph) => (
                <p key={paragraph}>{paragraph}</p>
              ))}
            </div>
          ) : null}

          <div className="surface-wood flex flex-col gap-4 rounded-xl border border-bronze/40 p-5">
            <ProductPrice price={product.price} size="lg" />
            <StockLabel inStock={product.inStock} lowStockRemaining={product.lowStockRemaining} />
            <AddToCartButton
              size="lg"
              product={{
                id: product.id,
                slug: product.slug,
                name: product.name,
                price: product.price.current,
              }}
              disabled={!product.inStock || !product.purchasable}
            />
          </div>
          {product.sku ? (
            <p className="text-xs text-muted-foreground">
              {productPageTexts.sku}: {product.sku}
            </p>
          ) : null}
        </div>
      </div>

      {product.description.length > 0 ? (
        <section className="mt-12 max-w-3xl">
          <h2 className="text-engraved text-2xl font-bold">
            {productPageTexts.descriptionHeading}
          </h2>
          <div className="mt-4 space-y-3 text-foreground/85">
            {product.description.map((paragraph) => (
              <p key={paragraph}>{paragraph}</p>
            ))}
          </div>
        </section>
      ) : null}
    </article>
  );
}
