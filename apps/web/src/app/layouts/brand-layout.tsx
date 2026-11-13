import { brandIds } from "@kg/brand-config";
import type { Metadata } from "next";

import { getCategories } from "@/entities/category/index.server";
import { routes } from "@/shared/config";
import { getBrandOrNotFound } from "@/shared/config/index.server";
import { CartDrawer } from "@/widgets/cart-drawer";
import { Footer } from "@/widgets/footer";
import { Header, type HeaderNavItem } from "@/widgets/header";

import { AppProviders } from "./app-providers";
import { appTexts } from "../config/texts";
import { BrandThemeStyle } from "../theme/brand-theme-style";

type BrandLayoutProps = {
  children: React.ReactNode;
  params: Promise<{ brand: string }>;
};

export function generateBrandStaticParams() {
  return brandIds.map((brand) => ({ brand }));
}

export async function generateBrandMetadata({
  params,
}: Pick<BrandLayoutProps, "params">): Promise<Metadata> {
  const brand = getBrandOrNotFound((await params).brand);
  return {
    title: { default: `${brand.name} - ${brand.texts.tagline}`, template: `%s | ${brand.name}` },
    description: brand.texts.heroSubtitle,
  };
}

/** A navigáció a Woo-kategóriákból jön; Woo-kiesésnél a menü üres, de az oldal megmarad. */
async function getNav(brand: Parameters<typeof getCategories>[0]): Promise<HeaderNavItem[]> {
  try {
    const categories = await getCategories(brand);
    return categories.map((category) => ({
      href: routes.category(category.slug),
      label: category.name,
    }));
  } catch {
    return [];
  }
}

export async function BrandLayout({ children, params }: BrandLayoutProps) {
  const brand = getBrandOrNotFound((await params).brand);
  const nav = await getNav(brand);

  return (
    <>
      <BrandThemeStyle brand={brand} />
      <AppProviders brandId={brand.id}>
        <div className="flex min-h-dvh flex-col">
          <a
            href="#tartalom"
            className="sr-only z-50 rounded-md bg-primary px-3 py-2 text-primary-foreground focus:not-sr-only focus:fixed focus:top-3 focus:left-3"
          >
            {appTexts.skipToContent}
          </a>
          <Header
            brandName={brand.name}
            tagline={brand.texts.tagline}
            nav={nav}
            cart={<CartDrawer />}
          />
          <main id="tartalom" className="flex-1">
            {children}
          </main>
          <Footer brandName={brand.name} note={brand.texts.footerNote} />
        </div>
      </AppProviders>
    </>
  );
}
