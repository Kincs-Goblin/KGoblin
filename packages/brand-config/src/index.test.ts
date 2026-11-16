import { describe, expect, it } from "vitest";

import { brands, resolveBrandByHost, themeSchema, themeToCssVars, validateBrands } from "./index";

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
    second.domains = ["www.gamer.localhost"];

    expect(() => validateBrands([first, second])).toThrow(/Duplikált domain/);
  });

  it("elutasítja a duplikált brand azonosítót", () => {
    const first = structuredClone(brands[0]!);
    const second = structuredClone(brands[0]!);
    second.domains = ["masik.localhost"];

    expect(() => validateBrands([first, second])).toThrow(/Duplikált brand azonosító/);
  });
});
