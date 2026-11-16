import type { Brand } from "@kg/brand-config";

import { getBrandEnvPrefix } from "../brand-url";
import { WooError } from "../errors";

/**
 * Brandenkénti Woo webhook-titok feloldása (`WOO_<BRAND>_WEBHOOK_SECRET`).
 */
export function resolveBrandWebhookSecret(
  brand: Brand,
  env: Record<string, string | undefined> = process.env,
): string {
  const prefix = getBrandEnvPrefix(brand);
  const secretEnv = `${prefix}_WEBHOOK_SECRET`;
  const secret = env[secretEnv]?.trim();
  if (!secret) {
    throw new WooError(
      "WOO.UNAVAILABLE",
      `Hiányzó Woo webhook titok környezeti változó: ${secretEnv}`,
    );
  }
  return secret;
}
