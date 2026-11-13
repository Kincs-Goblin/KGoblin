import "server-only";

import type { Brand } from "@kg/brand-config";
import { z } from "zod";

const serverEnvSchema = z.object({
  /** `1`: a katalógus Woo helyett a mentett Store API-fixture-ökből jön (CI e2e, Docker nélküli fejlesztés). */
  KG_STORE_FIXTURES: z.enum(["0", "1"]).default("0"),
  /** Vercel futási környezet (production | preview | development). */
  VERCEL_ENV: z.enum(["production", "preview", "development"]).optional(),
});

const brandWooSecretsSchema = z.object({
  baseUrl: z.string().url("Érvényes URL szükséges (pl. https://woo.example.com)"),
  consumerKey: z.string().min(1).optional(),
  consumerSecret: z.string().min(1).optional(),
  webhookSecret: z.string().min(1).optional(),
});

export type BrandWooEnv = z.infer<typeof brandWooSecretsSchema>;

/**
 * Szerveroldali env-séma validálása. Értéket (titkot) soha nem ír ki a hibaüzenetbe, csak a változó nevét.
 */
export function parseServerEnv(raw: NodeJS.ProcessEnv) {
  const normalized = {
    KG_STORE_FIXTURES: raw.KG_STORE_FIXTURES || undefined,
    VERCEL_ENV: raw.VERCEL_ENV || undefined,
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

export const serverEnv = parseServerEnv(process.env);

/** A brand Woo-címe a brand-configban megnevezett env-változóból; hiányzónál `undefined`, hibás URL-nél érthető hiba (érték nélkül). */
export function getWooBaseUrl(
  brand: Brand,
  raw: NodeJS.ProcessEnv = process.env,
): string | undefined {
  const envKey = brand.woo.baseUrlEnv;
  const value = raw[envKey]?.trim();
  if (!value) return undefined;

  const parsed = z.string().url().safeParse(value);
  if (!parsed.success) {
    throw new Error(`Érvénytelen URL a(z) ${envKey} környezeti változóban.`);
  }
  return parsed.data;
}

/**
 * Brandenkénti Woo REST v3 és webhook konfiguráció feloldása (`WOO_<BRAND>_URL`, `_CONSUMER_KEY`, `_CONSUMER_SECRET`, `_WEBHOOK_SECRET`).
 * Hiányzó kötelező változónál érthető hibával áll meg, a titok értékének naplózása nélkül.
 */
export function getBrandWooEnv(
  brand: Brand,
  options?: { requireRestCredentials?: boolean; requireWebhookSecret?: boolean },
  raw: NodeJS.ProcessEnv = process.env,
): BrandWooEnv {
  const prefix = `WOO_${brand.id.toUpperCase().replace(/-/g, "_")}`;
  const urlKey = brand.woo.baseUrlEnv;
  const consumerKeyName = `${prefix}_CONSUMER_KEY`;
  const consumerSecretName = `${prefix}_CONSUMER_SECRET`;
  const webhookSecretName = `${prefix}_WEBHOOK_SECRET`;

  const baseUrlRaw = raw[urlKey]?.trim();
  if (!baseUrlRaw) {
    throw new Error(`Hiányzó kötelező környezeti változó: ${urlKey}`);
  }

  const parsed = brandWooSecretsSchema.safeParse({
    baseUrl: baseUrlRaw,
    consumerKey: raw[consumerKeyName]?.trim() || undefined,
    consumerSecret: raw[consumerSecretName]?.trim() || undefined,
    webhookSecret: raw[webhookSecretName]?.trim() || undefined,
  });

  if (!parsed.success) {
    throw new Error(`Érvénytelen környezeti változó a(z) ${brand.id} brandhez: ${urlKey}`);
  }

  if (options?.requireRestCredentials) {
    if (!parsed.data.consumerKey) {
      throw new Error(`Hiányzó kötelező környezeti változó: ${consumerKeyName}`);
    }
    if (!parsed.data.consumerSecret) {
      throw new Error(`Hiányzó kötelező környezeti változó: ${consumerSecretName}`);
    }
  }

  if (options?.requireWebhookSecret && !parsed.data.webhookSecret) {
    throw new Error(`Hiányzó kötelező környezeti változó: ${webhookSecretName}`);
  }

  return parsed.data;
}
