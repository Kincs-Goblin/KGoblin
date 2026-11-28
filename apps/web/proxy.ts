import { NextResponse, type NextRequest } from "next/server";

import { resolveRequestBrand } from "@/shared/config";

/**
 * Domain → brand: a kérést a `/<brand>/…` útvonalra írja át. Ismeretlen hostra 404
 * (`BRAND.UNKNOWN_HOST`), nincs alapértelmezett brand (fail-closed).
 * A `?brand=` query paraméter kizárólag `development` módban használható.
 */
export function proxy(request: NextRequest) {
  const brand = resolveRequestBrand(request);

  if (!brand) {
    return new NextResponse("BRAND.UNKNOWN_HOST", { status: 404 });
  }

  const url = request.nextUrl.clone();
  url.pathname = `/${brand.id}${url.pathname === "/" ? "" : url.pathname}`;
  const response = NextResponse.rewrite(url);

  if (process.env.NEXT_PUBLIC_APP_ENV !== "production") {
    response.headers.set("X-Robots-Tag", "noindex, nofollow");
  }

  return response;
}

// A kizárás perjelre vagy pontos fájlnévre illeszkedik, így pl. a `/apiary` slug is brand-rewrite-ot kap.
// A `/robots.txt`, `/sitemap.xml` és `/sitemap/*.xml` kérések a brand útvonalára íródnak át.
export const config = {
  matcher: ["/((?!api/|_next/static/|_next/image|favicon\\.ico$).*)"],
};
