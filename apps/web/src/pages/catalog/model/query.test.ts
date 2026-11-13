import { catalogHref, parseCatalogQuery, sortOptions } from "./query";

describe("parseCatalogQuery", () => {
  it("ismeretlen rendezésre az alapértelmezettet adja", () => {
    expect(parseCatalogQuery({ rendezes: "<script>" })).toEqual({
      sort: "ajanlott",
      onSale: false,
    });
  });

  it("a rendezést és az akciós szűrőt felismeri", () => {
    expect(parseCatalogQuery({ rendezes: "ar-csokkeno", akcios: "1" })).toEqual({
      sort: "ar-csokkeno",
      onSale: true,
    });
    expect(sortOptions["ar-csokkeno"]).toEqual({ orderby: "price", order: "desc" });
  });
});

describe("catalogHref", () => {
  it("csak a nem alapértelmezett paramétereket teszi az URL-be", () => {
    expect(catalogHref("/termekek", { sort: "ajanlott", onSale: false })).toBe("/termekek");
    expect(catalogHref("/kategoria/x", { sort: "uj", onSale: true })).toBe(
      "/kategoria/x?rendezes=uj&akcios=1",
    );
  });
});
