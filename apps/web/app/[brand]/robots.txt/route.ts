import { getBrandById } from "@kg/brand-config";

import { isIndexableEnv, renderRobotsTxt } from "@/shared/lib/seo";

type RouteContext = {
  params: Promise<{ brand: string }>;
};

export async function GET(_request: Request, { params }: RouteContext): Promise<Response> {
  const brand = getBrandById((await params).brand);
  if (!brand) {
    return new Response("Not Found", { status: 404 });
  }

  const indexable = isIndexableEnv();
  const headers = new Headers({
    "Content-Type": "text/plain; charset=utf-8",
    "Cache-Control": "public, max-age=300, s-maxage=300",
  });
  if (!indexable) {
    headers.set("X-Robots-Tag", "noindex, nofollow");
  }

  return new Response(renderRobotsTxt(brand, indexable), { status: 200, headers });
}
