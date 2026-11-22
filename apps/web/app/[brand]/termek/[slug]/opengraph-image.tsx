import { getBrandById } from "@kg/brand-config";
import { ImageResponse } from "next/og";

import { getProduct } from "@/entities/product/index.server";
import { formatMoney } from "@/shared/lib/format";
import { renderOgCard } from "@/shared/lib/seo";

export const alt = "Termék előnézeti kép";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

type Props = {
  params: Promise<{ brand: string; slug: string }>;
};

export default async function ProductOpenGraphImage({ params }: Props) {
  const { brand: brandId, slug } = await params;
  const brand = getBrandById(brandId);
  if (!brand) {
    return new Response("Not Found", { status: 404 });
  }

  const product = await getProduct(brand, slug).catch(() => null);
  const subtitle = product?.summary.join(" ") || brand.texts.defaultDescription;
  const priceLabel = product ? formatMoney(product.price.current, brand.locale) : undefined;
  const badgeLabel = product?.price.onSale
    ? "Akciós"
    : product?.stockStatus === "out_of_stock"
      ? "Elfogyott"
      : product
        ? "Raktáron"
        : undefined;

  return new ImageResponse(
    renderOgCard({
      brand,
      eyebrow: product?.categories[0]?.name ?? brand.texts.tagline,
      title: product?.name ?? brand.name,
      subtitle,
      priceLabel,
      badgeLabel,
      imageUrl: product?.image?.src,
    }),
    size,
  );
}
