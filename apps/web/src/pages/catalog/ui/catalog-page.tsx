import { isWooError, type WooErrorCode } from "@kg/woo-client";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import type { Category } from "@/entities/category";
import { getCategories, getCategoryBySlug } from "@/entities/category/index.server";
import type { CatalogFilterAttribute, ProductPageResult } from "@/entities/product";
import { getCatalogAttributes, getProductsPage } from "@/entities/product/index.server";
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
    const page = await getProductsPage(brand, toProductQuery(query, category?.id));
    return { ok: true, category, categories, attributes, query, page };
  } catch (error) {
    // Woo-kiesésnél barátságos hibaállapot; minden más (pl. notFound) megy tovább.
    if (isWooError(error)) return { ok: false, code: error.code };
    throw error;
  }
}

export async function generateCatalogMetadata({
  params,
}: Pick<CatalogPageProps, "params">): Promise<Metadata> {
  const { brand: brandId, slug } = await params;
  if (!slug) return { title: catalogTexts.allTitle };
  const category = await getCategoryBySlug(getBrandOrNotFound(brandId), slug).catch(() => null);
  return { title: category?.name ?? catalogTexts.allTitle };
}

export async function CatalogPage({ params, searchParams }: CatalogPageProps) {
  const { brand: brandId, slug } = await params;
  const rawSearchParams = await searchParams;
  const data = await loadCatalog(brandId, slug, rawSearchParams);

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
      />

      <div className="mt-6 lg:grid lg:grid-cols-[260px_1fr] lg:gap-6">
        <CatalogFilterSidebar
          basePath={basePath}
          activeCategory={data.category}
          categories={data.categories}
          attributes={data.attributes}
          query={data.query}
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
