import { isWooError, type WooErrorCode } from "@kg/woo-client";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { cache } from "react";

import type { Category } from "@/entities/category";
import { getCategories, getCategoryBySlug } from "@/entities/category/index.server";
import type { CatalogFilterAttribute, ProductPageResult } from "@/entities/product";
import {
  getCatalogAttributes,
  getProductsPage,
  getStoreMinorUnit,
} from "@/entities/product/index.server";
import {
  catalogHref,
  countActiveFilters,
  parseCatalogQuery,
  toProductQuery,
  type CatalogQueryState,
  type CatalogSearchParams,
} from "../model/query";
import { CatalogFilterSidebar, CatalogFilterToolbar } from "./catalog-filters";
import { CatalogPagination } from "./catalog-pagination";
import { routes } from "@/shared/config";
import { getBrandOrNotFound } from "@/shared/config/index.server";
import { getCurrencyLabel } from "@/shared/lib/format";
import {
  JsonLd,
  buildBreadcrumbJsonLd,
  buildCanonicalUrl,
  buildPageMetadata,
} from "@/shared/lib/seo";
import { buttonVariants } from "@/shared/ui/button";
import { ErrorState } from "@/shared/ui/error-state";
import { ProductGrid } from "@/widgets/product-grid";

import { catalogTexts } from "../config/texts";

type CatalogPageProps = {
  params: Promise<{ brand: string; slug?: string }>;
  searchParams: Promise<CatalogSearchParams>;
};

type CatalogData =
  | {
      ok: true;
      currencyUnit: string;
      category: Category | null;
      categories: Category[];
      attributes: CatalogFilterAttribute[];
      query: CatalogQueryState;
      page: ProductPageResult;
    }
  | { ok: false; code: WooErrorCode };

async function loadCatalog(
  brandId: string,
  slug: string | undefined,
  rawSearchParams: CatalogSearchParams,
): Promise<CatalogData> {
  const brand = getBrandOrNotFound(brandId);
  try {
    const [categories, attributes, category] = await Promise.all([
      getCategories(brand),
      getCatalogAttributes(brand),
      slug ? getCategoryBySlug(brand, slug) : Promise.resolve(null),
    ]);
    if (slug && !category) notFound();

    const query = parseCatalogQuery(rawSearchParams, attributes);
    const hasPriceFilter = query.minPrice !== undefined || query.maxPrice !== undefined;
    const minorUnit = hasPriceFilter ? await getStoreMinorUnit(brand) : 0;
    const page = await getProductsPage(brand, toProductQuery(query, category?.id, minorUnit));
    const storeCurrency = page.products[0]?.price.current.currency ?? brand.currency;
    const currencyUnit = getCurrencyLabel(storeCurrency, brand.locale);
    return { ok: true, currencyUnit, category, categories, attributes, query, page };
  } catch (error) {
    // Woo-kiesésnél barátságos hibaállapot; minden más (pl. notFound) megy tovább.
    if (isWooError(error)) return { ok: false, code: error.code };
    throw error;
  }
}

/**
 * Kérésenként egyszer fut a metadata és az oldal között. A Woo-fetchek `AbortSignal` miatt a Next
 * fetch-memoizációján kívül esnek, így enélkül kiesésnél kétszer várnánk a timeoutot. A kulcs a
 * szerializált query, mert a searchParams objektum-azonossága nem garantált.
 */
const loadCatalogOnce = cache((brandId: string, slug: string | undefined, queryKey: string) =>
  loadCatalog(brandId, slug, JSON.parse(queryKey) as CatalogSearchParams),
);

function hasSearchQueryParam(searchParams: CatalogSearchParams): boolean {
  const raw = searchParams.q ?? searchParams.kereses;
  const value = Array.isArray(raw) ? raw[0] : raw;
  return Boolean(value?.trim());
}

export async function generateCatalogMetadata({
  params,
  searchParams,
}: CatalogPageProps): Promise<Metadata> {
  const { brand: brandId, slug } = await params;
  const brand = getBrandOrNotFound(brandId);
  const rawSearchParams = await searchParams;
  // Ugyanaz a betöltés, mint az oldalé: bármelyik Woo-hívás hibájánál a 200-as hibaállapot
  // `noindex`-et kap a `<head>`-ben.
  const data = await loadCatalogOnce(brandId, slug, JSON.stringify(rawSearchParams));
  if (!data.ok) {
    return { title: catalogTexts.allTitle, robots: { index: false } };
  }

  const isOutOfRange =
    data.page.products.length === 0 &&
    data.page.totalPages > 0 &&
    data.query.page > data.page.totalPages;
  const noIndex = hasSearchQueryParam(rawSearchParams) || isOutOfRange;
  if (!data.category) {
    return buildPageMetadata({
      brand,
      title: catalogTexts.allTitle,
      description: catalogTexts.allIntro,
      canonicalPath: routes.products,
      noIndex,
    });
  }

  const categoryPath = routes.category(data.category.slug);
  return buildPageMetadata({
    brand,
    title: data.category.name,
    description: data.category.description || catalogTexts.allIntro,
    canonicalPath: categoryPath,
    ogImage: {
      url: buildCanonicalUrl(brand, `${categoryPath}/opengraph-image`),
      alt: data.category.name,
    },
    noIndex,
  });
}

export async function CatalogPage({ params, searchParams }: CatalogPageProps) {
  const { brand: brandId, slug } = await params;
  const brand = getBrandOrNotFound(brandId);
  const data = await loadCatalogOnce(brandId, slug, JSON.stringify(await searchParams));

  if (!data.ok) {
    return (
      <section className="mx-auto max-w-7xl px-4 py-16 sm:px-6">
        <ErrorState code={data.code} title={catalogTexts.errorTitle} />
      </section>
    );
  }

  const basePath = data.category ? routes.category(data.category.slug) : routes.products;
  const title = data.category?.name ?? catalogTexts.allTitle;
  const intro = data.category?.description || catalogTexts.allIntro;
  const activeFilterCount = countActiveFilters(data.query);
  const isOutOfRange =
    data.page.products.length === 0 &&
    data.page.totalPages > 0 &&
    data.query.page > data.page.totalPages;

  return (
    <section className="mx-auto max-w-7xl px-4 py-8 sm:px-6 sm:py-10">
      <JsonLd
        data={buildBreadcrumbJsonLd(brand, [
          { name: catalogTexts.breadcrumbHome, path: routes.home },
          { name: title, path: basePath },
        ])}
      />
      <nav aria-label={catalogTexts.breadcrumbLabel} className="text-sm text-muted-foreground">
        <Link href={routes.home} className="hover:text-gold">
          {catalogTexts.breadcrumbHome}
        </Link>
        <span aria-hidden="true"> / </span>
        <span aria-current="page">{title}</span>
      </nav>
      <h1 className="text-engraved mt-3 text-3xl font-bold sm:text-4xl">{title}</h1>
      <p className="mt-2 max-w-2xl text-muted-foreground">{intro}</p>

      <CatalogFilterToolbar
        basePath={basePath}
        activeCategory={data.category}
        categories={data.categories}
        attributes={data.attributes}
        query={data.query}
        total={data.page.total}
        currencyUnit={data.currencyUnit}
      />

      <div className="mt-6 lg:grid lg:grid-cols-[260px_1fr] lg:gap-6">
        <CatalogFilterSidebar
          basePath={basePath}
          activeCategory={data.category}
          categories={data.categories}
          attributes={data.attributes}
          query={data.query}
          currencyUnit={data.currencyUnit}
        />

        <div className="min-w-0">
          <p className="mb-4 text-sm text-muted-foreground" aria-live="polite">
            {catalogTexts.resultCount(data.page.total)}
          </p>

          {isOutOfRange ? (
            <div className="surface-wood flex flex-col items-center gap-3 rounded-xl border border-bronze/40 px-6 py-12 text-center">
              <p className="font-heading text-lg font-semibold text-foreground">
                {catalogTexts.emptyOutOfRangeTitle}
              </p>
              <p className="max-w-md text-sm text-muted-foreground">
                {catalogTexts.emptyOutOfRangeHint}
              </p>
              <Link
                href={catalogHref(basePath, { ...data.query, page: 1 })}
                className={buttonVariants({
                  variant: "outline",
                  className: "mt-2 border-gold/60 text-gold hover:bg-gold/10",
                })}
              >
                {catalogTexts.firstPage}
              </Link>
            </div>
          ) : data.page.products.length === 0 && activeFilterCount > 0 ? (
            <div className="surface-wood flex flex-col items-center gap-3 rounded-xl border border-bronze/40 px-6 py-12 text-center">
              <p className="font-heading text-lg font-semibold text-foreground">
                {catalogTexts.emptyFilteredTitle}
              </p>
              <p className="max-w-md text-sm text-muted-foreground">
                {catalogTexts.emptyFilteredHint}
              </p>
              <Link
                href={basePath}
                className={buttonVariants({
                  variant: "outline",
                  className: "mt-2 border-gold/60 text-gold hover:bg-gold/10",
                })}
              >
                {catalogTexts.clearFilters}
              </Link>
            </div>
          ) : (
            <ProductGrid
              products={data.page.products}
              className="grid grid-cols-2 gap-3 sm:gap-5 lg:grid-cols-3"
            />
          )}

          <CatalogPagination
            basePath={basePath}
            query={data.query}
            totalPages={data.page.totalPages}
          />
        </div>
      </div>
    </section>
  );
}
