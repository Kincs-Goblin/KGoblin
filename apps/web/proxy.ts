import { resolveBrandByHost } from "@kg/brand-config";
import { NextResponse, type NextRequest } from "next/server";

/**
 * Preview és demo környezetben minden válaszra `X-Robots-Tag: noindex, nofollow` kerül,
 * hogy a keresőmotorok csak az éles (production) oldalt indexeljék.
 */
export function isNoIndexEnvironment(env: NodeJS.ProcessEnv = process.env): boolean {
  const appEnv = env.NEXT_PUBLIC_APP_ENV;
  const vercelEnv = env.VERCEL_ENV;
  return appEnv === "preview" || appEnv === "demo" || vercelEnv === "preview";
}

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
  const response = NextResponse.rewrite(url);

  if (isNoIndexEnvironment()) {
    response.headers.set("X-Robots-Tag", "noindex, nofollow");
  }

  return response;
}

export const config = {
  matcher: ["/((?!api|_next/static|_next/image|favicon.ico|robots.txt|sitemap.xml).*)"],
};
