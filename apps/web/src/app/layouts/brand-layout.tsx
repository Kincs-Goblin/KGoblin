import { brandIds } from "@kg/brand-config";
import type { Metadata } from "next";

import { getBrandOrNotFound } from "@/shared/config/index.server";
import { Footer } from "@/widgets/footer";
import { Header } from "@/widgets/header";

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

export async function BrandLayout({ children, params }: BrandLayoutProps) {
  const brand = getBrandOrNotFound((await params).brand);

  return (
    <>
      <BrandThemeStyle brand={brand} />
      <AppProviders>
        <div className="flex min-h-dvh flex-col">
          <a
            href="#tartalom"
            className="sr-only z-50 rounded-md bg-primary px-3 py-2 text-primary-foreground focus:not-sr-only focus:fixed focus:top-3 focus:left-3"
          >
            {appTexts.skipToContent}
          </a>
          <Header brandName={brand.name} tagline={brand.texts.tagline} />
          <main id="tartalom" className="flex-1">
            {children}
          </main>
          <Footer brandName={brand.name} note={brand.texts.footerNote} />
        </div>
      </AppProviders>
    </>
  );
}
