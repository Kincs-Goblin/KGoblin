import { isWooError, type WooErrorCode } from "@kg/woo-client";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import type { Category } from "@/entities/category";
import { getCategories, getCategoryBySlug } from "@/entities/category/index.server";
import type { Product } from "@/entities/product";
import { getProducts } from "@/entities/product/index.server";
import { routes } from "@/shared/config";
import { getBrandOrNotFound } from "@/shared/config/index.server";
import { cn } from "@/shared/lib/utils";
import { ErrorState } from "@/shared/ui/error-state";
import { ProductGrid } from "@/widgets/product-grid";

import { catalogTexts } from "../config/texts";
import {
  catalogHref,
  parseCatalogQuery,
  sortOptions,
  type CatalogSearchParams,
  type SortKey,
} from "../model/query";

type CatalogPageProps = {
  params: Promise<{ brand: string; slug?: string }>;
  searchParams: Promise<CatalogSearchParams>;
};

type CatalogData =
  | { ok: true; category: Category | null; categories: Category[]; products: Product[] }
  | { ok: false; code: WooErrorCode };

async function loadCatalog(
  brandId: string,
  slug: string | undefined,
  query: ReturnType<typeof parseCatalogQuery>,
): Promise<CatalogData> {
  const brand = getBrandOrNotFound(brandId);
  try {
    const categories = await getCategories(brand);
    const category = slug ? await getCategoryBySlug(brand, slug) : null;
    if (slug && !category) notFound();
    const products = await getProducts(brand, {
      category: category ? String(category.id) : undefined,
      onSale: query.onSale || undefined,
      perPage: 48,
      ...sortOptions[query.sort],
    });
    return { ok: true, category, categories, products };
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
  const query = parseCatalogQuery(await searchParams);
  const data = await loadCatalog(brandId, slug, query);

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

      <div
        role="group"
        aria-label={catalogTexts.filtersLabel}
        className="surface-wood mt-6 flex flex-col gap-4 rounded-xl border border-bronze/40 p-4 lg:flex-row lg:items-center lg:justify-between"
      >
        <ul aria-label={catalogTexts.categoriesLabel} className="flex flex-wrap gap-2">
          <FilterChip href={catalogHref(routes.products, query)} active={!data.category}>
            {catalogTexts.allCategories}
          </FilterChip>
          {data.categories.map((category) => (
            <FilterChip
              key={category.id}
              href={catalogHref(routes.category(category.slug), query)}
              active={data.category?.id === category.id}
            >
              {category.name}
            </FilterChip>
          ))}
        </ul>
        <ul aria-label={catalogTexts.sortLabel} className="flex flex-wrap items-center gap-2">
          <FilterChip
            href={catalogHref(basePath, { ...query, onSale: !query.onSale })}
            active={query.onSale}
          >
            {catalogTexts.onSaleOnly}
          </FilterChip>
          <li aria-hidden="true" className="ml-1 list-none text-sm text-muted-foreground">
            {catalogTexts.sortLabel}:
          </li>
          {(Object.keys(sortOptions) as SortKey[]).map((key) => (
            <FilterChip
              key={key}
              href={catalogHref(basePath, { ...query, sort: key })}
              active={query.sort === key}
            >
              {catalogTexts.sort[key]}
            </FilterChip>
          ))}
        </ul>
      </div>

      <p className="mt-6 mb-4 text-sm text-muted-foreground" aria-live="polite">
        {catalogTexts.resultCount(data.products.length)}
      </p>
      <ProductGrid products={data.products} />
    </section>
  );
}

function FilterChip({
  href,
  active,
  children,
}: {
  href: string;
  active: boolean;
  children: React.ReactNode;
}) {
  return (
    <li className="list-none">
      <Link
        href={href}
        scroll={false}
        aria-current={active ? "true" : undefined}
        className={cn(
          "block rounded-full border px-3 py-1 text-sm transition-colors focus-visible:ring-2 focus-visible:ring-ring/60 focus-visible:outline-none",
          active
            ? "border-gold bg-gold text-gold-foreground"
            : "border-bronze/60 text-foreground/90 hover:border-gold hover:text-gold",
        )}
      >
        {children}
      </Link>
    </li>
  );
}
