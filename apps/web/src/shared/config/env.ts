import "server-only";

import { z } from "zod";

import { FIXTURES_IN_PRODUCTION_MESSAGE, isFixtureModeForbidden } from "./env-guards";

const serverEnvSchema = z
  .object({
    /** `1`: a katalógus Woo helyett a mentett Store API-fixture-ökből jön (CI e2e, Docker nélküli fejlesztés). */
    KG_STORE_FIXTURES: z.enum(["0", "1"]).default("0"),
    NEXT_PUBLIC_APP_ENV: z.enum(["local", "preview", "demo", "production"]).default("local"),
  })
  .refine((env) => !isFixtureModeForbidden(env.KG_STORE_FIXTURES, env.NEXT_PUBLIC_APP_ENV), {
    path: ["KG_STORE_FIXTURES"],
    message: FIXTURES_IN_PRODUCTION_MESSAGE,
  });

/**
 * Szerveroldali env-séma validálása. Értéket (titkot) soha nem ír ki a hibaüzenetbe, csak a változó nevét.
 * A Woo-címek és -kulcsok feloldása a `@kg/woo-client` dolga (`resolveBrandBaseUrl`, `getBrandEnvPrefix`).
 */
export function parseServerEnv(raw: NodeJS.ProcessEnv) {
  const normalized = {
    KG_STORE_FIXTURES: raw.KG_STORE_FIXTURES || undefined,
    NEXT_PUBLIC_APP_ENV: raw.NEXT_PUBLIC_APP_ENV || undefined,
  };
  const result = serverEnvSchema.safeParse(normalized);
  if (!result.success) {
    const issues = result.error.issues
      .map((issue) => `${issue.path.join(".") || "env"}: ${issue.message}`)
      .join("; ");
    throw new Error(`Érvénytelen szerveroldali környezeti változó (${issues})`);
  }
  return result.data;
}

// A `process.env.NEXT_PUBLIC_APP_ENV` közvetlen elérése a buildkor beégetett értéket adja, így egy hiányzó
// futásidejű változó nem kapcsolja ki a production fixture-őrt.
export const serverEnv = parseServerEnv({
  ...process.env,
  NEXT_PUBLIC_APP_ENV: process.env.NEXT_PUBLIC_APP_ENV,
});
