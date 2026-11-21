import type { Brand } from "@kg/brand-config";
import { isWooError, type WooErrorCode } from "@kg/woo-client";
import type { Metadata } from "next";
import { PHASE_PRODUCTION_BUILD } from "next/constants";
import Link from "next/link";
import { cache, Suspense } from "react";

import { CategoryCard, type Category } from "@/entities/category";
import { getCategories } from "@/entities/category/index.server";
import { RarityBadge, rarities, type Product } from "@/entities/product";
import { getProducts } from "@/entities/product/index.server";
import { routes } from "@/shared/config";
import { getBrandOrNotFound } from "@/shared/config/index.server";
import { buttonVariants } from "@/shared/ui/button";
import { ErrorState } from "@/shared/ui/error-state";
import { Reveal } from "@/shared/ui/motion";
import { ProductGrid } from "@/widgets/product-grid";

import { homeTexts } from "../config/texts";
import { HomeSectionsSkeleton } from "./home-skeleton";

type HomePageProps = {
  params: Promise<{ brand: string }>;
};

type HomeData =
  { ok: true; featured: Product[]; categories: Category[] } | { ok: false; code: WooErrorCode };

/** Kérésenként egyszer (metadata + oldal); a Woo-fetchek `AbortSignal` miatt nem memoizáltak. */
const loadHome = cache(async (brand: Brand): Promise<HomeData> => {
  try {
    const [featuredProducts, categories] = await Promise.all([
      getProducts(brand, { featured: true, perPage: 8, orderby: "menu_order", order: "asc" }),
      getCategories(brand),
    ]);
    const featured =
      featuredProducts.length > 0
        ? featuredProducts
        : await getProducts(brand, { perPage: 8, orderby: "menu_order", order: "asc" });
    return { ok: true, featured, categories };
  } catch (error) {
    // Csak buildkor rendereljük a hibaállapotot (a `revalidate` úgyis lecseréli). Futáskor a hiba
    // továbbmegy: az ISR-újragenerálás elbukik, és a legutóbbi jó oldal marad a cache-ben.
    if (isWooError(error) && process.env.NEXT_PHASE === PHASE_PRODUCTION_BUILD) {
      return { ok: false, code: error.code };
    }
    throw error;
  }
});

/** A buildkor renderelt hibaállapot (ISR, legfeljebb a `revalidate` idejéig) ne kerüljön indexbe. */
export async function generateHomeMetadata({ params }: HomePageProps): Promise<Metadata> {
  const data = await loadHome(getBrandOrNotFound((await params).brand));
  return data.ok ? {} : { robots: { index: false } };
}

async function HomeCatalogSections({ brand }: { brand: Brand }) {
  const data = await loadHome(brand);

  if (!data.ok) {
    return (
      <section className="mx-auto max-w-7xl px-4 pt-14 sm:px-6">
        <ErrorState code={data.code} title={homeTexts.errorTitle} />
      </section>
    );
  }

  return (
    <>
      <section aria-labelledby="kiemelt" className="mx-auto max-w-7xl px-4 pt-14 sm:px-6">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <h2 id="kiemelt" className="text-engraved text-2xl font-bold sm:text-3xl">
            {homeTexts.featuredHeading}
          </h2>
          <Link
            href={routes.products}
            className="text-sm text-gold underline-offset-4 hover:underline"
          >
            {homeTexts.featuredMore}
          </Link>
        </div>
        <div className="mt-6">
          <ProductGrid products={data.featured} />
        </div>
      </section>

      {data.categories.length > 0 ? (
        <section aria-labelledby="kategoriak" className="mx-auto max-w-7xl px-4 pt-14 sm:px-6">
          <h2 id="kategoriak" className="text-engraved text-2xl font-bold sm:text-3xl">
            {homeTexts.categoriesHeading}
          </h2>
          <ul className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {data.categories.map((category) => (
              <li key={category.id}>
                <CategoryCard category={category} />
              </li>
            ))}
          </ul>
        </section>
      ) : null}
    </>
  );
}

export async function HomePage({ params }: HomePageProps) {
  const brand = getBrandOrNotFound((await params).brand);

  return (
    <>
      <section className="mx-auto max-w-7xl px-4 pt-8 sm:px-6 sm:pt-12">
        <Reveal
          fade={false}
          className="frame-gold surface-stone relative overflow-hidden rounded-2xl px-6 py-14 text-center sm:px-12 sm:py-20"
        >
          <div
            aria-hidden="true"
            className="pointer-events-none absolute inset-x-0 -top-24 mx-auto h-64 w-2/3 rounded-full bg-glow opacity-40 blur-3xl"
          />
          <h1 className="text-engraved relative text-3xl font-bold text-balance sm:text-5xl">
            {brand.texts.heroTitle}
          </h1>
          <p className="relative mx-auto mt-4 max-w-2xl text-base text-pretty text-foreground/85 sm:text-lg">
            {brand.texts.heroSubtitle}
          </p>
          <Link
            href={routes.products}
            className={buttonVariants({
              size: "lg",
              className: "relative mt-8 h-11 px-6 text-base",
            })}
          >
            {brand.texts.heroCta}
          </Link>
        </Reveal>
      </section>

      <Suspense fallback={<HomeSectionsSkeleton />}>
        <HomeCatalogSections brand={brand} />
      </Suspense>

      <section aria-labelledby="ritkasag" className="mx-auto max-w-7xl px-4 pt-14 sm:px-6">
        <h2 id="ritkasag" className="text-engraved text-2xl font-bold sm:text-3xl">
          {homeTexts.rarityHeading}
        </h2>
        <p className="mt-2 max-w-2xl text-muted-foreground">{homeTexts.rarityIntro}</p>
        <ul className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {rarities.map((rarity) => (
            <li key={rarity} className="frame-gold rounded-xl p-5">
              <RarityBadge rarity={rarity} />
              <p className="mt-3 text-sm text-foreground/85">
                {homeTexts.rarityDescriptions[rarity]}
              </p>
            </li>
          ))}
        </ul>
      </section>
    </>
  );
}
