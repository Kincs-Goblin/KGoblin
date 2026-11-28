import { getBrandById, resolveBrandByHost, type Brand } from "@kg/brand-config";

type BrandResolutionRequest = {
  headers: Pick<Headers, "get">;
  nextUrl: {
    searchParams: Pick<URLSearchParams, "has" | "get">;
  };
};

/**
 * Kérés → brand feloldás (fail-closed: ismeretlen hostra `undefined`).
 * A `?brand=` query paraméter kizárólag `NODE_ENV === "development"` módban engedélyezett.
 */
export function resolveRequestBrand(request: BrandResolutionRequest): Brand | undefined {
  if (process.env.NODE_ENV === "development" && request.nextUrl.searchParams.has("brand")) {
    const queryBrand = request.nextUrl.searchParams.get("brand");
    return queryBrand ? getBrandById(queryBrand) : undefined;
  }
  return resolveBrandByHost(request.headers.get("host"));
}
