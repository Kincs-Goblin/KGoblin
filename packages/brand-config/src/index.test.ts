import { describe, expect, it } from "vitest";

import {
  brands,
  getBrandCanonicalOrigin,
  resolveBrandByHost,
  themeSchema,
  themeToCssVars,
  validateBrands,
} from "./index";

describe("resolveBrandByHost", () => {
  it("a brand domainjét portszámmal és www. előtaggal is felismeri", () => {
    expect(resolveBrandByHost("gamer.localhost:3000")?.id).toBe("gamer");
    expect(resolveBrandByHost("GAMER.localhost")?.id).toBe("gamer");
    expect(resolveBrandByHost("www.gamer.localhost:3000")?.id).toBe("gamer");
  });

  it("a demo Worker hostja a gamer brand, a Workers preview-hostja nem (ADR-0009)", () => {
    expect(resolveBrandByHost("kincsgoblin.devdemos.workers.dev")?.id).toBe("gamer");
    expect(resolveBrandByHost("abc123-kincsgoblin.devdemos.workers.dev")).toBeUndefined();
  });

  it("ismeretlen vagy hiányzó hostra nem ad alapértelmezett brandet", () => {
    expect(resolveBrandByHost("evil.example.com")).toBeUndefined();
    expect(resolveBrandByHost("localhost:3000")).toBeUndefined();
    expect(resolveBrandByHost("www.localhost:3000")).toBeUndefined();
    expect(resolveBrandByHost(null)).toBeUndefined();
  });
});

describe("themeToCssVars", () => {
  it("minden színtokent és a radiust CSS-változóvá alakít", () => {
    const vars = themeToCssVars(brands[0]!.theme);
    expect(vars["--background"]).toBeDefined();
    expect(vars["--rarity-legendary"]).toBeDefined();
    expect(vars["--radius"]).toBe(brands[0]!.theme.radius);
  });
});

describe("themeSchema", () => {
  it("elutasítja a stíluslapot megtörő értéket", () => {
    const theme = structuredClone(brands[0]!.theme);
    theme.colors.background = "red; } body { display: none";
    expect(themeSchema.safeParse(theme).success).toBe(false);
  });
});

describe("validateBrands", () => {
  it("a regisztrált domainek nem fedik át egymást a brandek között", () => {
    const all = brands.flatMap((brand) => brand.domains);
    expect(new Set(all).size).toBe(all.length);
  });

  it("elutasítja a két brand közötti duplikált domaint (www. változatot is)", () => {
    const first = structuredClone(brands[0]!);
    const second = structuredClone(brands[0]!);
    second.id = "masodik";
    second.woo.baseUrlEnv = "WOO_MASODIK_URL";
    second.search.index = "products_masodik";
    second.domains = ["www.gamer.localhost"];

    expect(() => validateBrands([first, second])).toThrow(/Duplikált domain/);
  });

  it("elutasítja a duplikált brand azonosítót", () => {
    const first = structuredClone(brands[0]!);
    const second = structuredClone(brands[0]!);
    second.domains = ["masik.localhost"];

    expect(() => validateBrands([first, second])).toThrow(/Duplikált brand azonosító/);
  });

  it("elutasítja a duplikált Woo baseUrlEnv értéket két brand között", () => {
    const first = structuredClone(brands[0]!);
    const second = structuredClone(brands[0]!);
    second.id = "masodik";
    second.domains = ["masodik.localhost"];
    second.search.index = "products_masodik";

    expect(() => validateBrands([first, second])).toThrow(/Duplikált Woo baseUrlEnv/);
  });

  it("elutasítja a duplikált Meilisearch indexet két brand között (kis- és nagybetűtől függetlenül)", () => {
    const first = structuredClone(brands[0]!);
    const second = structuredClone(brands[0]!);
    second.id = "masodik";
    second.domains = ["masodik.localhost"];
    second.woo.baseUrlEnv = "WOO_MASODIK_URL";
    second.search.index = first.search.index.toUpperCase();

    expect(() => validateBrands([first, second])).toThrow(/Duplikált Meilisearch index/);
  });
});

describe("getBrandCanonicalOrigin", () => {
  it("az első nem-localhost domaint adja https sémával", () => {
    expect(getBrandCanonicalOrigin(brands[0]!)).toBe("https://kincsgoblin.devdemos.workers.dev");
  });

  it("kifejezett canonicalDomain esetén azt használja", () => {
    const custom = structuredClone(brands[0]!);
    custom.canonicalDomain = "kincsgoblin.hu";
    expect(getBrandCanonicalOrigin(custom)).toBe("https://kincsgoblin.hu");
  });

  it("csak localhost domain esetén http sémával tér vissza", () => {
    const localOnly = structuredClone(brands[0]!);
    localOnly.domains = ["gamer.localhost"];
    expect(getBrandCanonicalOrigin(localOnly)).toBe("http://gamer.localhost");
  });
});
