import type { Metadata } from "next";
import Link from "next/link";

import { CategoryCard, type Category } from "@/entities/category";
import { getCategories } from "@/entities/category/index.server";
import { HighlightedText } from "@/features/search";
import {
  searchProducts,
  type SearchProductsResult,
  type SearchSortKey,
} from "@/shared/api/index.server";
import { routes } from "@/shared/config";
import { getBrandOrNotFound } from "@/shared/config/index.server";
import { isAppError, type ErrorCode } from "@/shared/lib/errors";
import { formatMoney } from "@/shared/lib/format";
import { buildPageMetadata } from "@/shared/lib/seo";
import { buttonVariants } from "@/shared/ui/button";
import { ErrorState } from "@/shared/ui/error-state";
import { Input } from "@/shared/ui/input";

import { searchPageTexts } from "../config/texts";
import { parseSearchQuery, searchHref, type SearchPageSearchParams } from "../model/query";

type SearchPageProps = {
  params: Promise<{ brand: string }>;
  searchParams: Promise<SearchPageSearchParams>;
};

const RESULTS_PER_PAGE = 9;
const SORT_KEYS: readonly SearchSortKey[] = [
  "relevance",
  "price_asc",
  "price_desc",
  "popularity",
  "name",
];

/** A keresési találati oldal minden környezetben `noindex` (KG-51, KG-52). */
export async function generateSearchMetadata({
  params,
  searchParams,
}: SearchPageProps): Promise<Metadata> {
  const brand = getBrandOrNotFound((await params).brand);
  const query = parseSearchQuery(await searchParams);

  return buildPageMetadata({
    brand,
    title: query.q ? searchPageTexts.titleWithQuery(query.q) : searchPageTexts.title,
    description: searchPageTexts.description,
    canonicalPath: routes.search,
    noIndex: true,
  });
}

export async function SearchPage({ params, searchParams }: SearchPageProps) {
  const brand = getBrandOrNotFound((await params).brand);
  const query = parseSearchQuery(await searchParams);

  const [categoriesResult, searchResult] = await Promise.all([
    getCategories(brand).catch((): Category[] => []),
    query.q
      ? searchProducts(brand, {
          q: query.q,
          category: query.category,
          inStock: query.inStock,
          onSale: query.onSale,
          minPrice: query.minPrice,
          maxPrice: query.maxPrice,
          sort: query.sort,
          page: query.page,
          perPage: RESULTS_PER_PAGE,
        })
          .then((data): { ok: true; data: SearchProductsResult } => ({ ok: true, data }))
          .catch((error): { ok: false; code: ErrorCode } => ({
            ok: false,
            code: isAppError(error) ? error.code : "SEARCH.UNAVAILABLE",
          }))
      : Promise.resolve(null),
  ]);

  const categoryNameBySlug = new Map(categoriesResult.map((cat) => [cat.slug, cat.name]));
  const hasActiveFilters = Boolean(
    query.category ||
    query.inStock ||
    query.onSale ||
    query.minPrice !== undefined ||
    query.maxPrice !== undefined,
  );

  return (
    <section className="mx-auto max-w-7xl px-4 py-8 sm:px-6 sm:py-10">
      <nav aria-label={searchPageTexts.breadcrumbLabel} className="text-sm text-muted-foreground">
        <Link href={routes.home} className="hover:text-gold">
          {searchPageTexts.breadcrumbHome}
        </Link>
        <span aria-hidden="true"> / </span>
        <span aria-current="page">{searchPageTexts.title}</span>
      </nav>

      <h1 className="text-engraved mt-3 text-3xl font-bold sm:text-4xl">
        {query.q ? searchPageTexts.headingQuery(query.q) : searchPageTexts.headingEmpty}
      </h1>

      <form role="search" action={routes.search} method="GET" className="mt-5 flex max-w-xl gap-2">
        <Input
          type="search"
          name="q"
          defaultValue={query.q}
          aria-label={searchPageTexts.inputLabel}
          placeholder={searchPageTexts.inputPlaceholder}
          className="h-11 bg-surface-wood-dark/70"
        />
        <button type="submit" className={buttonVariants({ size: "lg", className: "h-11 px-5" })}>
          {searchPageTexts.submitButton}
        </button>
      </form>

      {!query.q ? (
        <div className="mt-8">
          <p className="text-muted-foreground">{searchPageTexts.noQueryHint}</p>
          {categoriesResult.length > 0 ? (
            <ul className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {categoriesResult.slice(0, 6).map((category) => (
                <li key={category.id}>
                  <CategoryCard category={category} />
                </li>
              ))}
            </ul>
          ) : null}
        </div>
      ) : searchResult && !searchResult.ok ? (
        <div className="mt-8">
          <ErrorState code={searchResult.code} title={searchPageTexts.errorTitle} />
        </div>
      ) : searchResult && searchResult.ok ? (
        <div className="mt-8 lg:grid lg:grid-cols-[260px_1fr] lg:gap-8">
          <aside aria-label={searchPageTexts.facetsHeading} className="space-y-6">
            <div className="surface-wood rounded-xl border border-bronze/40 p-4">
              <h2 className="font-heading text-sm font-semibold tracking-wide text-gold uppercase">
                {searchPageTexts.categoriesHeading}
              </h2>
              <ul className="mt-3 space-y-1.5 text-sm">
                <li>
                  <Link
                    href={searchHref({ ...query, category: undefined, page: 1 })}
                    className={`block rounded-md px-2.5 py-1.5 transition-colors ${
                      !query.category
                        ? "bg-accent font-semibold text-gold"
                        : "text-foreground/85 hover:bg-accent/50"
                    }`}
                  >
                    {searchPageTexts.allCategories}
                  </Link>
                </li>
                {Object.entries(searchResult.data.facets.categorySlugs)
                  .sort(([, a], [, b]) => b - a)
                  .map(([slug, count]) => {
                    const active = query.category === slug;
                    return (
                      <li key={slug}>
                        <Link
                          href={searchHref({
                            ...query,
                            category: active ? undefined : slug,
                            page: 1,
                          })}
                          className={`flex items-center justify-between rounded-md px-2.5 py-1.5 transition-colors ${
                            active
                              ? "bg-accent font-semibold text-gold"
                              : "text-foreground/85 hover:bg-accent/50"
                          }`}
                        >
                          <span className="truncate">{categoryNameBySlug.get(slug) ?? slug}</span>
                          <span className="ml-2 text-xs text-muted-foreground">({count})</span>
                        </Link>
                      </li>
                    );
                  })}
              </ul>
            </div>

            <div className="surface-wood rounded-xl border border-bronze/40 p-4">
              <h2 className="font-heading text-sm font-semibold tracking-wide text-gold uppercase">
                {searchPageTexts.availabilityHeading}
              </h2>
              <div className="mt-3 flex flex-col gap-2 text-sm">
                <Link
                  href={searchHref({ ...query, inStock: !query.inStock, page: 1 })}
                  aria-pressed={query.inStock}
                  className={`flex items-center justify-between rounded-md px-2.5 py-1.5 transition-colors ${
                    query.inStock
                      ? "bg-accent font-semibold text-gold"
                      : "text-foreground/85 hover:bg-accent/50"
                  }`}
                >
                  <span>{searchPageTexts.inStockOnly}</span>
                  <span className="text-xs text-muted-foreground">
                    ({searchResult.data.facets.inStockCount})
                  </span>
                </Link>
                <Link
                  href={searchHref({ ...query, onSale: !query.onSale, page: 1 })}
                  aria-pressed={query.onSale}
                  className={`flex items-center justify-between rounded-md px-2.5 py-1.5 transition-colors ${
                    query.onSale
                      ? "bg-accent font-semibold text-gold"
                      : "text-foreground/85 hover:bg-accent/50"
                  }`}
                >
                  <span>{searchPageTexts.onSaleOnly}</span>
                  <span className="text-xs text-muted-foreground">
                    ({searchResult.data.facets.onSaleCount})
                  </span>
                </Link>
              </div>

              {hasActiveFilters ? (
                <Link
                  href={searchHref({ q: query.q })}
                  className="mt-4 block text-xs text-gold underline-offset-4 hover:underline"
                >
                  {searchPageTexts.clearFilters}
                </Link>
              ) : null}
            </div>
          </aside>

          <div className="mt-6 min-w-0 lg:mt-0">
            <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
              <p className="text-sm text-muted-foreground" aria-live="polite">
                {searchPageTexts.resultCount(searchResult.data.totalHits)}
              </p>
              <nav aria-label={searchPageTexts.sortLabel} className="flex flex-wrap gap-1.5">
                {SORT_KEYS.map((key) => {
                  const active = query.sort === key;
                  return (
                    <Link
                      key={key}
                      href={searchHref({ ...query, sort: key, page: 1 })}
                      aria-current={active ? "true" : undefined}
                      className={`rounded-md border px-2.5 py-1 text-xs transition-colors ${
                        active
                          ? "border-gold bg-gold/15 font-semibold text-gold"
                          : "border-bronze/40 text-muted-foreground hover:border-gold/60 hover:text-foreground"
                      }`}
                    >
                      {searchPageTexts.sortOptions[key]}
                    </Link>
                  );
                })}
              </nav>
            </div>

            {searchResult.data.hits.length === 0 ? (
              <div className="surface-wood rounded-xl border border-bronze/40 p-6 sm:p-8">
                <h2 className="font-heading text-xl font-semibold text-foreground">
                  {searchPageTexts.emptyTitle}
                </h2>
                <p className="mt-2 text-sm text-muted-foreground">{searchPageTexts.emptyHint}</p>
                {hasActiveFilters ? (
                  <Link
                    href={searchHref({ q: query.q })}
                    className={buttonVariants({
                      variant: "outline",
                      className: "mt-4 border-gold/60 text-gold hover:bg-gold/10",
                    })}
                  >
                    {searchPageTexts.clearFilters}
                  </Link>
                ) : null}
                {categoriesResult.length > 0 ? (
                  <div className="mt-6">
                    <h3 className="font-heading text-sm font-semibold text-gold uppercase">
                      {searchPageTexts.popularCategoriesHeading}
                    </h3>
                    <ul className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                      {categoriesResult.slice(0, 6).map((category) => (
                        <li key={category.id}>
                          <CategoryCard category={category} />
                        </li>
                      ))}
                    </ul>
                  </div>
                ) : null}
              </div>
            ) : (
              <>
                <ul className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
                  {searchResult.data.hits.map((hit) => {
                    const priceLabel = formatMoney(
                      {
                        amount: String(hit.priceMinor),
                        currency: hit.currency,
                        minorUnit: hit.minorUnit,
                      },
                      brand.locale,
                    );
                    const regularLabel = hit.onSale
                      ? formatMoney(
                          {
                            amount: String(hit.regularPriceMinor),
                            currency: hit.currency,
                            minorUnit: hit.minorUnit,
                          },
                          brand.locale,
                        )
                      : null;

                    return (
                      <li key={hit.id}>
                        <article className="frame-gold surface-wood flex h-full flex-col overflow-hidden rounded-xl transition-transform hover:-translate-y-0.5">
                          <Link
                            href={routes.product(hit.slug)}
                            className="flex flex-1 flex-col p-4"
                          >
                            <div className="relative aspect-[4/3] w-full overflow-hidden rounded-lg border border-bronze/40 bg-surface-wood-dark/70">
                              {hit.imageUrl ? (
                                // eslint-disable-next-line @next/next/no-img-element
                                <img
                                  src={hit.imageUrl}
                                  alt={hit.imageAlt}
                                  className="size-full object-cover"
                                />
                              ) : null}
                              {hit.onSale ? (
                                <span className="absolute top-2 left-2 rounded-full bg-gold px-2.5 py-0.5 text-xs font-bold text-background">
                                  {searchPageTexts.saleBadge}
                                </span>
                              ) : null}
                            </div>

                            <h2 className="mt-3 line-clamp-2 font-heading text-base font-semibold text-foreground">
                              <HighlightedText text={hit.highlightedName} />
                            </h2>

                            <div className="mt-auto pt-3">
                              <div className="flex items-baseline gap-2">
                                <span className="text-lg font-bold text-gold">{priceLabel}</span>
                                {regularLabel ? (
                                  <span className="text-xs text-muted-foreground line-through">
                                    {regularLabel}
                                  </span>
                                ) : null}
                              </div>
                              <p className="mt-1 text-xs text-muted-foreground">
                                {hit.stockStatus === "in_stock"
                                  ? searchPageTexts.inStockLabel
                                  : hit.stockStatus === "backorder"
                                    ? searchPageTexts.backorderLabel
                                    : searchPageTexts.outOfStockLabel}
                              </p>
                            </div>
                          </Link>
                        </article>
                      </li>
                    );
                  })}
                </ul>

                {searchResult.data.totalPages > 1 ? (
                  <nav
                    aria-label="Lapozás"
                    className="mt-8 flex items-center justify-center gap-3 text-sm"
                  >
                    {query.page > 1 ? (
                      <Link
                        href={searchHref({ ...query, page: query.page - 1 })}
                        className={buttonVariants({ variant: "outline", size: "sm" })}
                      >
                        {searchPageTexts.previousPage}
                      </Link>
                    ) : null}
                    <span className="text-muted-foreground">
                      {searchPageTexts.pageIndicator(query.page, searchResult.data.totalPages)}
                    </span>
                    {query.page < searchResult.data.totalPages ? (
                      <Link
                        href={searchHref({ ...query, page: query.page + 1 })}
                        className={buttonVariants({ variant: "outline", size: "sm" })}
                      >
                        {searchPageTexts.nextPage}
                      </Link>
                    ) : null}
                  </nav>
                ) : null}
              </>
            )}
          </div>
        </div>
      ) : null}
    </section>
  );
}
