import type { CatalogFilterAttribute } from "@/entities/product";

import {
  catalogHref,
  countActiveFilters,
  parseCatalogQuery,
  sortOptions,
  toggleAttributeFilter,
  toProductQuery,
} from "./query";

const sampleAttributes: CatalogFilterAttribute[] = [
  {
    id: 1,
    name: "Kapcsoló",
    taxonomy: "pa_kapcsolo",
    terms: [
      { id: 19, name: "Lineáris Red", slug: "linearis-red", count: 2 },
      { id: 20, name: "Taktilis Brown", slug: "taktilis-brown", count: 1 },
    ],
  },
  {
    id: 2,
    name: "Szín",
    taxonomy: "pa_szin",
    terms: [{ id: 22, name: "Goblin Arany", slug: "goblin-arany", count: 3 }],
  },
];

describe("parseCatalogQuery", () => {
  it("ismeretlen rendezésre az alapértelmezettet adja", () => {
    expect(parseCatalogQuery({ rendezes: "<script>" })).toEqual({
      sort: "ajanlott",
      onSale: false,
      inStockOnly: false,
      attributes: [],
      page: 1,
    });
    expect(parseCatalogQuery({ rendezes: "constructor" }).sort).toBe("ajanlott");
  });

  it("felismeri a rendezést, akciós, raktáron, ár és oldal paramétereket", () => {
    expect(
      parseCatalogQuery({
        rendezes: "ar-csokkeno",
        akcios: "1",
        raktaron: "1",
        min: "10000",
        max: "50000",
        oldal: "2",
      }),
    ).toEqual({
      sort: "ar-csokkeno",
      onSale: true,
      inStockOnly: true,
      minPrice: 10000,
      maxPrice: 50000,
      attributes: [],
      page: 2,
    });
    expect(sortOptions["ar-csokkeno"]).toEqual({ orderby: "price", order: "desc" });
    expect(sortOptions.nepszeruseg).toEqual({ orderby: "popularity", order: "desc" });
  });

  it("felcseréli a min és max árat, ha min > max, és kiszűri az érvénytelen értékeket", () => {
    const parsed = parseCatalogQuery({ min: "45000", max: "15000", oldal: "-3" });
    expect(parsed.minPrice).toBe(15000);
    expect(parsed.maxPrice).toBe(45000);
    expect(parsed.page).toBe(1);
  });

  it("validálja a dinamikus Woo attribútumszűrőket az ismert lista ellenében", () => {
    const parsed = parseCatalogQuery(
      {
        attr_pa_szin: "goblin-arany",
        attr_pa_kapcsolo: "nem-letezo",
        attr_unknown: "valami",
      },
      sampleAttributes,
    );
    expect(parsed.attributes).toEqual([{ attribute: "pa_szin", slug: "goblin-arany" }]);
  });

  it("átveszi a q / kereses paramétert és továbbítja a Store API search mezőjébe", () => {
    const byQ = parseCatalogQuery({ q: "  billentyűzet  " });
    expect(byQ.search).toBe("billentyűzet");
    expect(toProductQuery(byQ)).toMatchObject({ search: "billentyűzet" });
    expect(catalogHref("/termekek", byQ)).toBe("/termekek?q=billenty%C5%B1zet");

    const byKereses = parseCatalogQuery({ kereses: "egér" });
    expect(byKereses.search).toBe("egér");
  });
});

describe("catalogHref", () => {
  it("csak a nem alapértelmezett paramétereket teszi az URL-be", () => {
    expect(catalogHref("/termekek", { sort: "ajanlott", onSale: false })).toBe("/termekek");
    expect(
      catalogHref("/kategoria/x", {
        sort: "uj",
        onSale: true,
        inStockOnly: true,
        minPrice: 5000,
        maxPrice: 30000,
        attributes: [{ attribute: "pa_szin", slug: "goblin-arany" }],
        page: 2,
      }),
    ).toBe(
      "/kategoria/x?rendezes=uj&akcios=1&raktaron=1&min=5000&max=30000&attr_pa_szin=goblin-arany&oldal=2",
    );
  });
});

describe("toggleAttributeFilter & countActiveFilters & toProductQuery", () => {
  it("ki- és bekapcsolja az attribútum-választást, és helyes Woo-lekérdezést épít", () => {
    const added = toggleAttributeFilter([], "pa_szin", "goblin-arany");
    expect(added).toEqual([{ attribute: "pa_szin", slug: "goblin-arany" }]);
    expect(toggleAttributeFilter(added, "pa_szin", "goblin-arany")).toEqual([]);

    const state = parseCatalogQuery(
      { raktaron: "1", min: "10000", attr_pa_szin: "goblin-arany", rendezes: "nepszeruseg" },
      sampleAttributes,
    );
    expect(countActiveFilters(state)).toBe(3);
    expect(toProductQuery(state, 31)).toMatchObject({
      category: "31",
      stockStatus: "instock",
      minPrice: 10000,
      attributes: [{ attribute: "pa_szin", slug: "goblin-arany" }],
      orderby: "popularity",
      order: "desc",
      page: 1,
    });
  });

  it("minorUnit > 0 esetén felszorozza a minPrice/maxPrice határokat", () => {
    const state = parseCatalogQuery({ min: "15", max: "49" }, sampleAttributes);
    expect(toProductQuery(state, undefined, 2)).toMatchObject({
      minPrice: 1500,
      maxPrice: 4900,
    });
  });
});
