"use client";

import { useMemo, useState } from "react";

import {
  ProductPrice,
  RarityBadge,
  StockLabel,
  type Product,
  type ProductVariation,
} from "@/entities/product";
import { AddToCartButton } from "@/features/add-to-cart";
import { cn } from "@/shared/lib/utils";

import { productPageTexts } from "../config/texts";
import { ProductGallery } from "./product-gallery";

function variationHasTerm(variation: ProductVariation, taxonomy: string, slug: string): boolean {
  return variation.attributes.some((attr) => attr.taxonomy === taxonomy && attr.slug === slug);
}

function getInitialSelection(product: Product): Record<string, string> {
  const initialVariation =
    product.variations.find((variation) => variation.inStock && variation.purchasable) ??
    product.variations[0];
  if (!initialVariation) return {};
  return Object.fromEntries(initialVariation.attributes.map((attr) => [attr.taxonomy, attr.slug]));
}

export function ProductDetails({ product }: { product: Product }) {
  const variationAttributes = useMemo(
    () => product.attributes.filter((attr) => attr.hasVariations && attr.terms.length > 0),
    [product.attributes],
  );
  const specAttributes = useMemo(
    () => product.attributes.filter((attr) => !attr.hasVariations && attr.terms.length > 0),
    [product.attributes],
  );

  const [selected, setSelected] = useState<Record<string, string>>(() =>
    getInitialSelection(product),
  );

  const activeVariation = useMemo(() => {
    if (product.variations.length === 0) return null;
    return (
      product.variations.find((variation) =>
        variationAttributes.every(
          (attr) =>
            !selected[attr.taxonomy] ||
            variationHasTerm(variation, attr.taxonomy, selected[attr.taxonomy]!),
        ),
      ) ?? null
    );
  }, [product.variations, variationAttributes, selected]);

  function handleSelectTerm(attrIndex: number, taxonomy: string, slug: string) {
    setSelected((prev) => {
      const next = { ...prev, [taxonomy]: slug };
      const exactMatch = product.variations.find((variation) =>
        variationAttributes.every(
          (attr) =>
            !next[attr.taxonomy] ||
            variationHasTerm(variation, attr.taxonomy, next[attr.taxonomy]!),
        ),
      );
      if (exactMatch) return next;

      // Ha a későbbi attribútum korábbi választása nem létezik az új opcióval, ugorjunk az első érvényes variációra.
      const prefixAttrs = variationAttributes.slice(0, attrIndex + 1);
      const fallback =
        product.variations.find((variation) =>
          prefixAttrs.every(
            (attr) =>
              !next[attr.taxonomy] ||
              variationHasTerm(variation, attr.taxonomy, next[attr.taxonomy]!),
          ),
        ) ?? product.variations.find((variation) => variationHasTerm(variation, taxonomy, slug));

      if (!fallback) return next;
      return Object.fromEntries(fallback.attributes.map((attr) => [attr.taxonomy, attr.slug]));
    });
  }

  function isOptionEnabled(attrIndex: number, taxonomy: string, slug: string): boolean {
    if (attrIndex === 0) {
      return product.variations.some((variation) => variationHasTerm(variation, taxonomy, slug));
    }
    const previousAttrs = variationAttributes.slice(0, attrIndex);
    return product.variations.some(
      (variation) =>
        variationHasTerm(variation, taxonomy, slug) &&
        previousAttrs.every(
          (prevAttr) =>
            !selected[prevAttr.taxonomy] ||
            variationHasTerm(variation, prevAttr.taxonomy, selected[prevAttr.taxonomy]!),
        ),
    );
  }

  const hasVariationSelectors = product.variations.length > 0 && variationAttributes.length > 0;
  const isVariable = product.type === "variable" || hasVariationSelectors;
  const activePrice = activeVariation ? activeVariation.price : product.price;
  const activeStockStatus = activeVariation ? activeVariation.stockStatus : product.stockStatus;
  const activeInStock = activeVariation ? activeVariation.inStock : product.inStock;
  const activeOnBackorder = activeVariation ? activeVariation.onBackorder : product.onBackorder;
  const activeLowStock = activeVariation
    ? activeVariation.lowStockRemaining
    : product.lowStockRemaining;
  const activeDeliveryTime = activeVariation ? activeVariation.deliveryTime : product.deliveryTime;
  const activeSku = activeVariation?.sku || product.sku;
  const activePurchasable = isVariable
    ? Boolean(activeVariation && activeVariation.inStock && activeVariation.purchasable)
    : product.inStock && product.purchasable;
  const variantLabel = activeVariation
    ? activeVariation.attributes.map((attr) => attr.value).join(", ")
    : undefined;

  return (
    <>
      <div className="mt-6 grid gap-8 lg:grid-cols-2 lg:gap-12">
        <div className="frame-gold rounded-2xl p-3">
          <ProductGallery
            images={product.images}
            rarity={product.rarity}
            productName={product.name}
            activeImage={activeVariation?.image ?? null}
          />
        </div>

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

          {hasVariationSelectors ? (
            <div
              role="group"
              aria-label={productPageTexts.variantGroupLabel}
              className="surface-wood flex flex-col gap-4 rounded-xl border border-bronze/40 p-4"
            >
              {variationAttributes.map((attr, attrIndex) => (
                <div key={attr.taxonomy} className="flex flex-col gap-2">
                  <span className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
                    {attr.name}
                  </span>
                  <div className="flex flex-wrap gap-2">
                    {attr.terms.map((term) => {
                      const isSelected = selected[attr.taxonomy] === term.slug;
                      const enabled = isOptionEnabled(attrIndex, attr.taxonomy, term.slug);
                      return (
                        <button
                          key={term.slug}
                          type="button"
                          disabled={!enabled}
                          aria-pressed={isSelected}
                          title={!enabled ? productPageTexts.unavailableCombination : undefined}
                          onClick={() => handleSelectTerm(attrIndex, attr.taxonomy, term.slug)}
                          className={cn(
                            "rounded-lg border px-3 py-1.5 text-sm transition-colors focus-visible:ring-2 focus-visible:ring-ring/60 focus-visible:outline-none",
                            isSelected
                              ? "border-gold bg-gold font-medium text-gold-foreground"
                              : enabled
                                ? "border-bronze/60 text-foreground/90 hover:border-gold hover:text-gold"
                                : "cursor-not-allowed border-border/30 text-muted-foreground/45 line-through",
                          )}
                        >
                          {term.name}
                        </button>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          ) : null}

          <div className="surface-wood flex flex-col gap-4 rounded-xl border border-bronze/40 p-5">
            <ProductPrice price={activePrice} size="lg" />
            <StockLabel
              stockStatus={activeStockStatus}
              inStock={activeInStock}
              onBackorder={activeOnBackorder}
              lowStockRemaining={activeLowStock}
              deliveryTime={activeDeliveryTime}
            />
            <AddToCartButton
              size="lg"
              product={{
                id: product.id,
                ...(activeVariation ? { variationId: activeVariation.id } : {}),
                ...(variantLabel ? { variantLabel } : {}),
                slug: product.slug,
                name: product.name,
                price: activePrice.current,
              }}
              disabled={!activePurchasable}
            />
          </div>

          {activeSku ? (
            <p className="text-xs text-muted-foreground">
              {productPageTexts.sku}: {activeSku}
            </p>
          ) : null}
        </div>
      </div>

      {specAttributes.length > 0 ? (
        <section className="mt-10 max-w-3xl">
          <h2 className="text-engraved text-xl font-bold">{productPageTexts.specsHeading}</h2>
          <dl className="surface-wood mt-3 divide-y divide-border/40 rounded-xl border border-bronze/40">
            {specAttributes.map((attr) => (
              <div
                key={attr.taxonomy || attr.name}
                className="flex justify-between gap-4 px-4 py-2.5 text-sm"
              >
                <dt className="text-muted-foreground">{attr.name}</dt>
                <dd className="text-right font-medium text-foreground">
                  {attr.terms.map((t) => t.name).join(", ")}
                </dd>
              </div>
            ))}
          </dl>
        </section>
      ) : null}

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
    </>
  );
}
