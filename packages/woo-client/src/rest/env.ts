import type { Brand } from "@kg/brand-config";

import { getBrandEnvPrefix, resolveBrandBaseUrl } from "../brand-url";
import { WooError } from "../errors";

export type BrandRestCredentials = {
  baseUrl: string;
  consumerKey: string;
  consumerSecret: string;
};

/**
 * Brandenkénti REST v3 hitelesítő adatok feloldása (`WOO_<BRAND>_URL`, `_CONSUMER_KEY`, `_CONSUMER_SECRET`).
 * A titok értéke soha nem kerülhet hibába vagy logba.
 */
export function resolveBrandRestCredentials(
  brand: Brand,
  env: Record<string, string | undefined> = process.env,
): BrandRestCredentials {
  const baseUrl = resolveBrandBaseUrl(brand, env);
  const prefix = getBrandEnvPrefix(brand);
  const keyEnv = `${prefix}_CONSUMER_KEY`;
  const secretEnv = `${prefix}_CONSUMER_SECRET`;

  const consumerKey = env[keyEnv]?.trim();
  if (!consumerKey) {
    throw new WooError("WOO.UNAVAILABLE", `Hiányzó Woo REST kulcs környezeti változó: ${keyEnv}`);
  }

  const consumerSecret = env[secretEnv]?.trim();
  if (!consumerSecret) {
    throw new WooError(
      "WOO.UNAVAILABLE",
      `Hiányzó Woo REST titok környezeti változó: ${secretEnv}`,
    );
  }

  return { baseUrl, consumerKey, consumerSecret };
}
