import type { ProductQuery } from "@kg/woo-client";

/** URL-paraméter → Store API-rendezés. A rendezést a Woo végzi, a kliens nem rendez árat. */
export const sortOptions = {
  ajanlott: { orderby: "menu_order", order: "asc" },
  "ar-novekvo": { orderby: "price", order: "asc" },
  "ar-csokkeno": { orderby: "price", order: "desc" },
  nevsor: { orderby: "title", order: "asc" },
  uj: { orderby: "date", order: "desc" },
} as const satisfies Record<string, Pick<ProductQuery, "orderby" | "order">>;

export type SortKey = keyof typeof sortOptions;

export type CatalogSearchParams = { rendezes?: string | string[]; akcios?: string | string[] };

const first = (value: string | string[] | undefined) => (Array.isArray(value) ? value[0] : value);

export function parseCatalogQuery(searchParams: CatalogSearchParams) {
  const sortParam = first(searchParams.rendezes);
  const sort: SortKey =
    sortParam && Object.hasOwn(sortOptions, sortParam) ? (sortParam as SortKey) : "ajanlott";
  const onSale = first(searchParams.akcios) === "1";
  return { sort, onSale };
}

/** Link egy szűrő vagy rendezés módosított állapotára (a többi paraméter megmarad). */
export function catalogHref(basePath: string, state: { sort: SortKey; onSale: boolean }) {
  const params = new URLSearchParams();
  if (state.sort !== "ajanlott") params.set("rendezes", state.sort);
  if (state.onSale) params.set("akcios", "1");
  const query = params.toString();
  return query ? `${basePath}?${query}` : basePath;
}
