import { getBrandById, getBrandCanonicalOrigin } from "@kg/brand-config";

import { buildBrandSitemapEntries } from "@/app/index.server";
import {
  MAX_URLS_PER_SITEMAP,
  isIndexableEnv,
  renderSitemapIndexXml,
  renderUrlSetXml,
} from "@/shared/lib/seo";

type RouteContext = {
  params: Promise<{ brand: string }>;
};

export async function GET(_request: Request, { params }: RouteContext): Promise<Response> {
  const brand = getBrandById((await params).brand);
  if (!brand) {
    return new Response("Not Found", { status: 404 });
  }

  const { entries, partial } = await buildBrandSitemapEntries(brand);
  const headers = new Headers({
    "Content-Type": "application/xml; charset=utf-8",
    "Cache-Control": partial
      ? "no-store"
      : "public, max-age=300, s-maxage=300, stale-while-revalidate=600",
  });
  if (!isIndexableEnv()) {
    headers.set("X-Robots-Tag", "noindex, nofollow");
  }

  if (entries.length > MAX_URLS_PER_SITEMAP) {
    const origin = getBrandCanonicalOrigin(brand);
    const totalChunks = Math.ceil(entries.length / MAX_URLS_PER_SITEMAP);
    const sitemaps = Array.from({ length: totalChunks }, (_, index) => ({
      loc: `${origin}/sitemap/${index + 1}.xml`,
    }));
    return new Response(renderSitemapIndexXml(sitemaps), { status: 200, headers });
  }

  return new Response(renderUrlSetXml(entries), { status: 200, headers });
}
