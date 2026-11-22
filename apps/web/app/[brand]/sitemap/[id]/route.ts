import { getBrandById } from "@kg/brand-config";

import { buildBrandSitemapEntries } from "@/app";
import { MAX_URLS_PER_SITEMAP, isIndexableEnv, renderUrlSetXml } from "@/shared/lib/seo";

type RouteContext = {
  params: Promise<{ brand: string; id: string }>;
};

export async function GET(_request: Request, { params }: RouteContext): Promise<Response> {
  const { brand: brandId, id } = await params;
  const brand = getBrandById(brandId);
  if (!brand) {
    return new Response("Not Found", { status: 404 });
  }

  const match = /^(\d+)(?:\.xml)?$/.exec(id);
  if (!match?.[1]) {
    return new Response("Not Found", { status: 404 });
  }

  const chunkNumber = Number.parseInt(match[1], 10);
  if (!Number.isSafeInteger(chunkNumber) || chunkNumber < 1) {
    return new Response("Not Found", { status: 404 });
  }

  const { entries, partial } = await buildBrandSitemapEntries(brand);
  const start = (chunkNumber - 1) * MAX_URLS_PER_SITEMAP;
  const slice = entries.slice(start, start + MAX_URLS_PER_SITEMAP);
  if (slice.length === 0) {
    return new Response("Not Found", { status: 404 });
  }

  const headers = new Headers({
    "Content-Type": "application/xml; charset=utf-8",
    "Cache-Control": partial
      ? "no-store"
      : "public, max-age=300, s-maxage=300, stale-while-revalidate=600",
  });
  if (!isIndexableEnv()) {
    headers.set("X-Robots-Tag", "noindex, nofollow");
  }

  return new Response(renderUrlSetXml(slice), { status: 200, headers });
}
