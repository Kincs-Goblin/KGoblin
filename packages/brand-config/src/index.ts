import { gamer } from "./brands/gamer";
import { brandSchema, colorTokenNames, type Brand, type BrandTheme } from "./schema";

export { brandSchema, colorTokenNames, fontKeys, themeSchema } from "./schema";
export type { Brand, BrandTheme, ColorTokenName, FontKey } from "./schema";

function normalizeDomain(domain: string): string {
  return domain.trim().toLowerCase().replace(/:\d+$/, "").replace(/\.$/, "");
}

function stripWww(hostname: string): string {
  return hostname.startsWith("www.") ? hostname.slice(4) : hostname;
}

/**
 * Validálja és ellenőrzi a brandek regisztrációját: minden brand átmegy a Zod-sémán, és sem
 * az azonosító, sem a domain (beleértve a `www.` változatot) nem fedheti át egymást.
 */
export function validateBrands(rawBrands: readonly Brand[]): readonly Brand[] {
  const parsed = rawBrands.map((brand) => brandSchema.parse(brand));
  const seenIds = new Set<string>();
  const seenDomains = new Map<string, string>();

  for (const brand of parsed) {
    if (seenIds.has(brand.id)) {
      throw new Error(`Duplikált brand azonosító: ${brand.id}`);
    }
    seenIds.add(brand.id);

    const brandDomains = brand.canonicalDomain
      ? [...brand.domains, brand.canonicalDomain]
      : brand.domains;
    for (const rawDomain of brandDomains) {
      const normalized = normalizeDomain(rawDomain);
      const canonical = stripWww(normalized);
      for (const key of [normalized, canonical]) {
        const owner = seenDomains.get(key);
        if (owner && owner !== brand.id) {
          throw new Error(
            `Duplikált domain a brand-configban (${rawDomain}): már a(z) "${owner}" brandhez tartozik.`,
          );
        }
        seenDomains.set(key, brand.id);
      }
    }
  }

  return parsed;
}

/** Minden brand itt regisztrálódik; betöltéskor Zod validálja, hibás config nem indul el. */
export const brands: readonly Brand[] = validateBrands([gamer]);

export const brandIds = brands.map((brand) => brand.id);

export function getBrandById(id: string): Brand | undefined {
  return brands.find((brand) => brand.id === id);
}

/** Host header (port nélkül vagy porttal, `www.` változattal) alapján; ismeretlen hostra `undefined` (fail-closed). */
export function resolveBrandByHost(host: string | null | undefined): Brand | undefined {
  if (!host) return undefined;
  const hostname = normalizeDomain(host);
  if (!hostname) return undefined;
  const bare = stripWww(hostname);
  return brands.find((brand) =>
    brand.domains.some((domain) => {
      const normalized = normalizeDomain(domain);
      return normalized === hostname || normalized === bare;
    }),
  );
}

/**
 * A brand elsődleges, kanonikus originje (`https://...`, csak helyi `.localhost` domain esetén `http://...`).
 * Elsősorban a `canonicalDomain`, egyébként az első nem-localhost domain a `domains` listából.
 */
export function getBrandCanonicalOrigin(brand: Brand): string {
  const isLocalHost = (host: string) => host === "localhost" || host.endsWith(".localhost");
  const candidate =
    brand.canonicalDomain ??
    brand.domains.find((domain) => !isLocalHost(normalizeDomain(domain))) ??
    brand.domains[0]!;
  const normalized = normalizeDomain(candidate);
  const protocol = isLocalHost(normalized) ? "http" : "https";
  return `${protocol}://${normalized}`;
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
