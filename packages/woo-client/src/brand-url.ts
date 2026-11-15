import type { Brand } from "@kg/brand-config";
import { z } from "zod";

import { WooError } from "./errors";

const urlSchema = z.string().url();

export function getBrandEnvPrefix(brand: Brand): string {
  return `WOO_${brand.id.toUpperCase().replace(/-/g, "_")}`;
}

/**
 * Feloldja a brand WooCommerce alap URL-jét a brand-configban megnevezett környezeti változóból.
 * Hibás vagy hiányzó értéknél csak a változó nevét írja a hibába, az értéket soha.
 */
export function resolveBrandBaseUrl(
  brand: Brand,
  env: Record<string, string | undefined> = process.env,
): string {
  const envKey = brand.woo.baseUrlEnv;
  const raw = env[envKey]?.trim();
  if (!raw) {
    throw new WooError("WOO.UNAVAILABLE", `Hiányzó Woo-cím környezeti változó: ${envKey}`);
  }
  const parsed = urlSchema.safeParse(raw);
  if (!parsed.success) {
    throw new WooError("WOO.UNAVAILABLE", `Érvénytelen URL a(z) ${envKey} környezeti változóban`);
  }
  return parsed.data;
}
