import { resolveBrandByHost } from "@kg/brand-config";
import { NextResponse, type NextRequest } from "next/server";

/**
 * Domain → brand: a kérést a `/<brand>/…` útvonalra írja át. Ismeretlen hostra 404
 * (`BRAND.UNKNOWN_HOST`), nincs alapértelmezett brand (fail-closed).
 */
export function proxy(request: NextRequest) {
  const brand = resolveBrandByHost(request.headers.get("host"));
  if (!brand) {
    return new NextResponse("BRAND.UNKNOWN_HOST", { status: 404 });
  }

  const url = request.nextUrl.clone();
  url.pathname = `/${brand.id}${url.pathname === "/" ? "" : url.pathname}`;
  return NextResponse.rewrite(url);
}

export const config = {
  matcher: ["/((?!api|_next/static|_next/image|favicon.ico|robots.txt|sitemap.xml).*)"],
};
