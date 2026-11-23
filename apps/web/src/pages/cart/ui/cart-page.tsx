import type { Metadata } from "next";

import { routes } from "@/shared/config";
import { getBrandOrNotFound } from "@/shared/config/index.server";
import { buildPageMetadata } from "@/shared/lib/seo";

import { cartPageTexts } from "../config/texts";
import { CartPageContent } from "./cart-page-content";

type CartPageProps = {
  params: Promise<{ brand: string }>;
};

/** A kosár oldal minden környezetben `noindex`. */
export async function generateCartMetadata({ params }: CartPageProps): Promise<Metadata> {
  const brand = getBrandOrNotFound((await params).brand);
  return buildPageMetadata({
    brand,
    title: cartPageTexts.title,
    description: cartPageTexts.description,
    canonicalPath: routes.cart,
    noIndex: true,
  });
}

export async function CartPage({ params }: CartPageProps) {
  const brand = getBrandOrNotFound((await params).brand);
  return <CartPageContent locale={brand.locale} />;
}
