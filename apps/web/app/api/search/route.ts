import { getBrandById, resolveBrandByHost, type Brand } from "@kg/brand-config";
import { NextResponse, type NextRequest } from "next/server";

import { searchProducts, type SearchSortKey } from "@/shared/api/index.server";
import { isAppError } from "@/shared/lib/errors";

const VALID_SORTS = new Set<SearchSortKey>([
  "relevance",
  "price_asc",
  "price_desc",
  "popularity",
  "name",
]);

function resolveRequestBrand(request: NextRequest): Brand | undefined {
  if (process.env.NODE_ENV === "development" && request.nextUrl.searchParams.has("brand")) {
    const queryBrand = request.nextUrl.searchParams.get("brand");
    return queryBrand ? getBrandById(queryBrand) : undefined;
  }
  return resolveBrandByHost(request.headers.get("host"));
}

function parseOptionalNonNegInt(raw: string | null): number | undefined {
  if (!raw || !/^\d+$/.test(raw.trim())) return undefined;
  const parsed = Number.parseInt(raw.trim(), 10);
  return Number.isSafeInteger(parsed) && parsed >= 0 ? parsed : undefined;
}

/**
 * BFF keresővégpont (`GET /api/search?q=...`).
 * A böngésző nem kap Meilisearch kulcsot; a host alapján feloldott brand indexét keresi (ADR-0012).
 */
export async function GET(request: NextRequest): Promise<NextResponse> {
  const brand = resolveRequestBrand(request);
  if (!brand) {
    return NextResponse.json(
      { ok: false, code: "BRAND.UNKNOWN_HOST", message: "Ismeretlen bolt-domain." },
      { status: 404, headers: { "Cache-Control": "no-store" } },
    );
  }

  const sp = request.nextUrl.searchParams;
  const q = (sp.get("q") ?? "").trim().slice(0, 120);
  const category = sp.get("kategoria")?.trim() || undefined;
  const inStock = sp.get("raktaron") === "1";
  const onSale = sp.get("akcios") === "1";
  const minPrice = parseOptionalNonNegInt(sp.get("min"));
  const maxPrice = parseOptionalNonNegInt(sp.get("max"));
  const rawSort = sp.get("rendezes") as SearchSortKey | null;
  const sort = rawSort && VALID_SORTS.has(rawSort) ? rawSort : "relevance";
  const page = Math.max(1, parseOptionalNonNegInt(sp.get("oldal")) ?? 1);
  const perPage = Math.min(24, Math.max(1, parseOptionalNonNegInt(sp.get("limit")) ?? 6));

  try {
    const result = await searchProducts(brand, {
      q,
      category,
      inStock,
      onSale,
      minPrice,
      maxPrice,
      sort,
      page,
      perPage,
    });
    return NextResponse.json(
      { ok: true, ...result },
      { status: 200, headers: { "Cache-Control": "no-store" } },
    );
  } catch (error) {
    if (isAppError(error)) {
      return NextResponse.json(
        { ok: false, code: error.code, message: error.userMessage },
        { status: error.status, headers: { "Cache-Control": "no-store" } },
      );
    }
    return NextResponse.json(
      { ok: false, code: "SEARCH.UNAVAILABLE", message: "A keresés átmenetileg nem érhető el." },
      { status: 503, headers: { "Cache-Control": "no-store" } },
    );
  }
}
