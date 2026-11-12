import { gamer } from "./brands/gamer";
import { brandSchema, colorTokenNames, type Brand, type BrandTheme } from "./schema";

export { brandSchema, colorTokenNames, fontKeys, themeSchema } from "./schema";
export type { Brand, BrandTheme, ColorTokenName, FontKey } from "./schema";

/** Minden brand itt regisztrálódik; betöltéskor Zod validálja, hibás config nem indul el. */
export const brands: readonly Brand[] = [gamer].map((brand) => brandSchema.parse(brand));

export const brandIds = brands.map((brand) => brand.id);

export function getBrandById(id: string): Brand | undefined {
  return brands.find((brand) => brand.id === id);
}

/** Host header (port nélkül vagy porttal) alapján; ismeretlen hostra `undefined` (fail-closed). */
export function resolveBrandByHost(host: string | null | undefined): Brand | undefined {
  if (!host) return undefined;
  const hostname = host.toLowerCase().split(":")[0];
  return brands.find((brand) => brand.domains.includes(hostname ?? ""));
}

/** A téma CSS-változói (`--background`, `--radius` …), a Tailwind `@theme` ezekre hivatkozik. */
export function themeToCssVars(theme: BrandTheme): Record<`--${string}`, string> {
  const vars: Record<`--${string}`, string> = {};
  for (const name of colorTokenNames) {
    vars[`--${name}`] = theme.colors[name];
  }
  vars["--radius"] = theme.radius;
  vars["--shadow-card"] = theme.shadows.card;
  vars["--shadow-glow"] = theme.shadows.glow;
  return vars;
}
