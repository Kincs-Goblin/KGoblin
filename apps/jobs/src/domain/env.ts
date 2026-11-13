import { getBrandById, type Brand } from "@kg/brand-config";
import { z } from "zod";

const jobsEnvSchema = z.object({
  TRIGGER_PROJECT_ID: z
    .string({
      error: "Hiányzó kötelező környezeti változó: TRIGGER_PROJECT_ID (formátum: proj_<azonosító>)",
    })
    .regex(/^proj_[a-zA-Z0-9_-]+$/, "TRIGGER_PROJECT_ID formátuma: proj_<azonosító>"),
  TRIGGER_SECRET_KEY: z.string().min(1).optional(),
  SENTRY_DSN: z.string().url("SENTRY_DSN érvényes URL legyen").optional(),
});

export type JobsEnv = z.infer<typeof jobsEnvSchema>;

export type BrandWooCredentials = {
  baseUrl: string;
  consumerKey: string;
  consumerSecret: string;
  webhookSecret?: string | undefined;
};

/**
 * A háttérjobok globális környezeti változóinak validálása.
 * Hiányzó `TRIGGER_PROJECT_ID` esetén érthető hibával áll meg.
 * Értéket (titkot) soha nem ír ki a hibaüzenetbe, csak a változó nevét.
 */
export function parseJobsEnv(raw: NodeJS.ProcessEnv = process.env): JobsEnv {
  const normalized = {
    TRIGGER_PROJECT_ID: raw.TRIGGER_PROJECT_ID?.trim() || undefined,
    TRIGGER_SECRET_KEY: raw.TRIGGER_SECRET_KEY?.trim() || undefined,
    SENTRY_DSN: raw.SENTRY_DSN?.trim() || undefined,
  };
  const result = jobsEnvSchema.safeParse(normalized);
  if (!result.success) {
    const issues = result.error.issues
      .map((issue) => `${issue.path.join(".") || "env"}: ${issue.message}`)
      .join("; ");
    throw new Error(`Érvénytelen @kg/jobs környezeti változó (${issues})`);
  }
  return result.data;
}

/**
 * Brandenkénti WooCommerce REST v3 hitelesítő adatok feloldása (`WOO_<BRAND>_URL`, `_CONSUMER_KEY`, `_CONSUMER_SECRET`).
 * Hiányzó vagy hibás változónál érthető hibával áll meg, a titok értékének naplózása nélkül.
 */
export function getBrandWooCredentials(
  brandOrId: Brand | string,
  raw: NodeJS.ProcessEnv = process.env,
): BrandWooCredentials {
  const brand = typeof brandOrId === "string" ? getBrandById(brandOrId) : brandOrId;
  if (!brand) {
    throw new Error(`Ismeretlen brand-azonosító: ${String(brandOrId)}`);
  }

  const prefix = `WOO_${brand.id.toUpperCase().replace(/-/g, "_")}`;
  const urlKey = brand.woo.baseUrlEnv;
  const consumerKeyName = `${prefix}_CONSUMER_KEY`;
  const consumerSecretName = `${prefix}_CONSUMER_SECRET`;
  const webhookSecretName = `${prefix}_WEBHOOK_SECRET`;

  const baseUrlRaw = raw[urlKey]?.trim();
  if (!baseUrlRaw) {
    throw new Error(`Hiányzó kötelező környezeti változó: ${urlKey}`);
  }
  const baseUrlParsed = z.string().url().safeParse(baseUrlRaw);
  if (!baseUrlParsed.success) {
    throw new Error(`Érvénytelen URL a(z) ${urlKey} környezeti változóban.`);
  }

  const consumerKey = raw[consumerKeyName]?.trim();
  if (!consumerKey) {
    throw new Error(`Hiányzó kötelező környezeti változó: ${consumerKeyName}`);
  }

  const consumerSecret = raw[consumerSecretName]?.trim();
  if (!consumerSecret) {
    throw new Error(`Hiányzó kötelező környezeti változó: ${consumerSecretName}`);
  }

  return {
    baseUrl: baseUrlParsed.data,
    consumerKey,
    consumerSecret,
    webhookSecret: raw[webhookSecretName]?.trim() || undefined,
  };
}
