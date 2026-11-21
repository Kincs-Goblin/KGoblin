import { getBrandById, resolveBrandByHost, type Brand } from "@kg/brand-config";
import { NextResponse, type NextRequest } from "next/server";

/**
 * Domain → brand: a kérést a `/<brand>/…` útvonalra írja át. Ismeretlen hostra 404
 * (`BRAND.UNKNOWN_HOST`), nincs alapértelmezett brand (fail-closed).
 * A `?brand=` query paraméter kizárólag `development` módban használható.
 */
export function proxy(request: NextRequest) {
  let brand: Brand | undefined;

  if (process.env.NODE_ENV === "development" && request.nextUrl.searchParams.has("brand")) {
    const queryBrand = request.nextUrl.searchParams.get("brand");
    brand = queryBrand ? getBrandById(queryBrand) : undefined;
  } else {
    brand = resolveBrandByHost(request.headers.get("host"));
  }

  if (!brand) {
    return new NextResponse("BRAND.UNKNOWN_HOST", { status: 404 });
  }

  const url = request.nextUrl.clone();
  url.pathname = `/${brand.id}${url.pathname === "/" ? "" : url.pathname}`;
  return NextResponse.rewrite(url);
}

// A kizárás perjelre vagy pontos fájlnévre illeszkedik, így pl. a `/apiary` slug is brand-rewrite-ot kap.
export const config = {
  matcher: ["/((?!api/|_next/static/|_next/image|favicon\\.ico$|robots\\.txt$|sitemap\\.xml$).*)"],
};
