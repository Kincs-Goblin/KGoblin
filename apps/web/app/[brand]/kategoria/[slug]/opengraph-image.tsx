import { getBrandById } from "@kg/brand-config";
import { ImageResponse } from "next/og";

import { getCategoryBySlug } from "@/entities/category/index.server";
import { renderOgCard } from "@/shared/lib/seo";

export const alt = "Kategória előnézeti kép";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

type Props = {
  params: Promise<{ brand: string; slug: string }>;
};

export default async function CategoryOpenGraphImage({ params }: Props) {
  const { brand: brandId, slug } = await params;
  const brand = getBrandById(brandId);
  if (!brand) {
    return new Response("Not Found", { status: 404 });
  }

  const category = await getCategoryBySlug(brand, slug).catch(() => null);
  const badgeLabel =
    category && category.productCount > 0 ? `${category.productCount} termék` : brand.texts.tagline;

  return new ImageResponse(
    renderOgCard({
      brand,
      eyebrow: "Kategória",
      title: category?.name ?? brand.name,
      subtitle: category?.description || brand.texts.defaultDescription,
      badgeLabel,
    }),
    size,
  );
}
