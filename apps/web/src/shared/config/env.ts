import "server-only";

import type { Brand } from "@kg/brand-config";
import { z } from "zod";

const serverEnvSchema = z.object({
  /** `1`: a katalógus Woo helyett a mentett Store API-fixture-ökből jön (CI e2e, Docker nélküli fejlesztés). */
  KG_STORE_FIXTURES: z.enum(["0", "1"]).default("0"),
});

export const serverEnv = serverEnvSchema.parse(process.env);

/** A brand Woo-címe a brand-configban megnevezett env-változóból; hiányzónál `undefined`. */
export function getWooBaseUrl(brand: Brand): string | undefined {
  const value = process.env[brand.woo.baseUrlEnv];
  return value ? z.string().url().parse(value) : undefined;
}
