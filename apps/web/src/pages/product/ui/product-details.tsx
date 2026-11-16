"use client";

import { useMemo, useState } from "react";

import {
  ProductPrice,
  RarityBadge,
  StockLabel,
  type Product,
  type ProductAttribute,
  type ProductVariation,
  type ProductVariationAttribute,
} from "@/entities/product";
import { AddToCartButton } from "@/features/add-to-cart";
import { cn } from "@/shared/lib/utils";

import { productPageTexts } from "../config/texts";
import { ProductGallery } from "./product-gallery";

function getAttributeKey(attr: Pick<ProductAttribute, "taxonomy" | "name">): string {
  return attr.taxonomy || attr.name;
}

function normalizeAttrKey(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9_-]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function variationAttrMatchesProductAttr(
  vAttr: Pick<ProductVariationAttribute, "taxonomy" | "name">,
  attr: Pick<ProductAttribute, "taxonomy" | "name">,
): boolean {
  if (attr.taxonomy) {
    return vAttr.taxonomy === attr.taxonomy;
  }
  if (vAttr.name.trim().toLowerCase() === attr.name.trim().toLowerCase()) {
    return true;
  }
  return vAttr.taxonomy !== "" && normalizeAttrKey(vAttr.taxonomy) === normalizeAttrKey(attr.name);
}

function variationMatchesOption(
  variation: ProductVariation,
  attr: Pick<ProductAttribute, "taxonomy" | "name">,
  slug: string,
): boolean {
  const entry = variation.attributes.find((vAttr) => variationAttrMatchesProductAttr(vAttr, attr));
  if (!entry) return false;
  return entry.slug === "" || entry.slug === slug;
}

/**
 * Konkrét attribútum-egyezések száma. Az üres slug ("Any ...") alacsonyabb prioritást kap,
 * így a konkrét variáció nyer a generikus ellen — megjegyzendő, hogy ez eltér a Woo
 * sorrendfüggő "első egyezés" logikájától, ha elfogyott konkrét + készletes "Any" ütközik.
 */
function variationSpecificity(
  variation: ProductVariation,
  variationAttributes: ProductAttribute[],
  selection: Record<string, string>,
): number {
  let score = 0;
  for (const attr of variationAttributes) {
    const selectedSlug = selection[getAttributeKey(attr)];
    if (!selectedSlug) continue;
    const entry = variation.attributes.find((vAttr) =>
      variationAttrMatchesProductAttr(vAttr, attr),
    );
    if (entry && entry.slug === selectedSlug) {
      score += 1;
    }
  }
  return score;
}

function findMatchingVariation(
  variations: ProductVariation[],
  variationAttributes: ProductAttribute[],
  selection: Record<string, string>,
): ProductVariation | null {
  let best: ProductVariation | null = null;
  let bestScore = -1;
  for (const variation of variations) {
    const matchesAll = variationAttributes.every((attr) => {
      const selectedSlug = selection[getAttributeKey(attr)];
      return !selectedSlug || variationMatchesOption(variation, attr, selectedSlug);
    });
    if (!matchesAll) continue;
    const score = variationSpecificity(variation, variationAttributes, selection);
    if (score > bestScore) {
      best = variation;
      bestScore = score;
    }
  }
  return best;
}

function selectionFromVariation(
  variation: ProductVariation,
  variationAttributes: ProductAttribute[],
  preferred?: Record<string, string>,
): Record<string, string> {
  const result: Record<string, string> = {};
  for (const attr of variationAttributes) {
    const key = getAttributeKey(attr);
    const entry = variation.attributes.find((vAttr) =>
      variationAttrMatchesProductAttr(vAttr, attr),
    );
    if (entry && entry.slug !== "") {
      result[key] = entry.slug;
    } else {
      const preferredSlug = preferred?.[key];
      const hasPreferred = preferredSlug && attr.terms.some((term) => term.slug === preferredSlug);
      const fallbackSlug = hasPreferred ? preferredSlug : attr.terms[0]?.slug;
      if (fallbackSlug) {
        result[key] = fallbackSlug;
      }
    }
  }
  return result;
}

function variationHasAllAttributes(
  variation: ProductVariation,
  variationAttributes: ProductAttribute[],
): boolean {
  return variationAttributes.every((attr) =>
    variation.attributes.some((vAttr) => variationAttrMatchesProductAttr(vAttr, attr)),
  );
}

function getInitialSelection(
  product: Product,
  variationAttributes: ProductAttribute[],
): Record<string, string> {
  const initialVariation =
    product.variations.find(
      (variation) =>
        variation.inStock &&
        variation.purchasable &&
        variationHasAllAttributes(variation, variationAttributes),
    ) ??
    product.variations.find((variation) =>
      variationHasAllAttributes(variation, variationAttributes),
    ) ??
    product.variations.find((variation) => variation.inStock && variation.purchasable) ??
    product.variations[0];
  if (!initialVariation) return {};
  return selectionFromVariation(initialVariation, variationAttributes);
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
    getInitialSelection(product, variationAttributes),
  );

  const activeVariation = useMemo(() => {
    if (product.variations.length === 0) return null;
    return findMatchingVariation(product.variations, variationAttributes, selected);
  }, [product.variations, variationAttributes, selected]);

  function handleSelectTerm(attrIndex: number, attr: ProductAttribute, slug: string) {
    const key = getAttributeKey(attr);
    const completeVariations = product.variations.filter((variation) =>
      variationHasAllAttributes(variation, variationAttributes),
    );
    setSelected((prev) => {
      const next = { ...prev, [key]: slug };
      const exactMatch = findMatchingVariation(completeVariations, variationAttributes, next);
      if (exactMatch) return next;

      // Ha a későbbi attribútum korábbi választása nem létezik az új opcióval, ugorjunk az első érvényes variációra.
      const prefixAttrs = variationAttributes.slice(0, attrIndex + 1);
      const fallback =
        findMatchingVariation(completeVariations, prefixAttrs, next) ??
        completeVariations.find((variation) => variationMatchesOption(variation, attr, slug));

      if (!fallback) return next;
      return selectionFromVariation(fallback, variationAttributes, next);
    });
  }

  function isOptionEnabled(attrIndex: number, attr: ProductAttribute, slug: string): boolean {
    if (attrIndex === 0) {
      return product.variations.some(
        (variation) =>
          variationHasAllAttributes(variation, variationAttributes) &&
          variationMatchesOption(variation, attr, slug),
      );
    }
    const previousAttrs = variationAttributes.slice(0, attrIndex);
    return product.variations.some(
      (variation) =>
        variationHasAllAttributes(variation, variationAttributes) &&
        variationMatchesOption(variation, attr, slug) &&
        previousAttrs.every((prevAttr) => {
          const prevSlug = selected[getAttributeKey(prevAttr)];
          return !prevSlug || variationMatchesOption(variation, prevAttr, prevSlug);
        }),
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
    ? variationAttributes
        .map((attr) => {
          const key = getAttributeKey(attr);
          const selectedSlug = selected[key];
          const selectedTerm = attr.terms.find((term) => term.slug === selectedSlug);
          if (selectedTerm) return selectedTerm.name;
          const entry = activeVariation.attributes.find((vAttr) =>
            variationAttrMatchesProductAttr(vAttr, attr),
          );
          return entry?.value || "";
        })
        .filter(Boolean)
        .join(", ") || undefined
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
              {variationAttributes.map((attr, attrIndex) => {
                const attrKey = getAttributeKey(attr);
                return (
                  <div key={attrKey} className="flex flex-col gap-2">
                    <span className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
                      {attr.name}
                    </span>
                    <div className="flex flex-wrap gap-2">
                      {attr.terms.map((term) => {
                        const isSelected = selected[attrKey] === term.slug;
                        const enabled = isOptionEnabled(attrIndex, attr, term.slug);
                        return (
                          <button
                            key={term.slug}
                            type="button"
                            disabled={!enabled}
                            aria-pressed={isSelected}
                            title={!enabled ? productPageTexts.unavailableCombination : undefined}
                            onClick={() => handleSelectTerm(attrIndex, attr, term.slug)}
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
                );
              })}
            </div>
          ) : null}

          <div className="surface-wood flex flex-col gap-4 rounded-xl border border-bronze/40 p-5">
            <ProductPrice price={activePrice} size="lg" locale={product.locale} />
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
