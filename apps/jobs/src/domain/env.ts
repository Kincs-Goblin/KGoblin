import { getBrandById, type Brand } from "@kg/brand-config";
import { z } from "zod";

import { AppError } from "./errors";

const jobsEnvSchema = z.object({
  TRIGGER_SECRET_KEY: z.string().min(1).optional(),
  SENTRY_DSN: z.string().url("SENTRY_DSN érvényes URL legyen").optional(),
});

export type JobsEnv = z.infer<typeof jobsEnvSchema>;

export type BrandWooCredentials = {
  baseUrl: string;
  consumerKey: string;
  consumerSecret: string;
};

/**
 * A háttérjobok globális környezeti változóinak validálása.
 * Értéket (titkot) soha nem ír ki a hibaüzenetbe, csak a változó nevét.
 */
export function parseJobsEnv(raw: NodeJS.ProcessEnv = process.env): JobsEnv {
  const normalized = {
    TRIGGER_SECRET_KEY: raw.TRIGGER_SECRET_KEY?.trim() || undefined,
    SENTRY_DSN: raw.SENTRY_DSN?.trim() || undefined,
  };
  const result = jobsEnvSchema.safeParse(normalized);
  if (!result.success) {
    const issues = result.error.issues
      .map((issue) => `${issue.path.join(".") || "env"}: ${issue.message}`)
      .join("; ");
    throw new AppError("JOB.CONFIG_MISSING", {
      internalReason: `Érvénytelen @kg/jobs környezeti változó (${issues})`,
    });
  }
  return result.data;
}

/**
 * Brandenkénti WooCommerce REST v3 hitelesítő adatok feloldása (`WOO_<BRAND>_URL`, `_CONSUMER_KEY`, `_CONSUMER_SECRET`).
 * Hiányzó vagy hibás változónál nem újrapróbálható `AppError`-ral (`BRAND.UNKNOWN_ID` / `JOB.CONFIG_MISSING`) áll meg,
 * a titok értékének naplózása nélkül.
 */
export function getBrandWooCredentials(
  brandOrId: Brand | string,
  raw: NodeJS.ProcessEnv = process.env,
): BrandWooCredentials {
  const brand = typeof brandOrId === "string" ? getBrandById(brandOrId) : brandOrId;
  if (!brand) {
    throw new AppError("BRAND.UNKNOWN_ID", {
      internalReason: `Ismeretlen brand-azonosító: ${String(brandOrId)}`,
    });
  }

  const prefix = `WOO_${brand.id.toUpperCase().replace(/-/g, "_")}`;
  const urlKey = brand.woo.baseUrlEnv;
  const consumerKeyName = `${prefix}_CONSUMER_KEY`;
  const consumerSecretName = `${prefix}_CONSUMER_SECRET`;

  const baseUrlRaw = raw[urlKey]?.trim();
  if (!baseUrlRaw) {
    throw new AppError("JOB.CONFIG_MISSING", {
      internalReason: `Hiányzó kötelező környezeti változó: ${urlKey}`,
    });
  }
  const baseUrlParsed = z.string().url().safeParse(baseUrlRaw);
  if (!baseUrlParsed.success) {
    throw new AppError("JOB.CONFIG_MISSING", {
      internalReason: `Érvénytelen URL a(z) ${urlKey} környezeti változóban.`,
    });
  }

  const consumerKey = raw[consumerKeyName]?.trim();
  if (!consumerKey) {
    throw new AppError("JOB.CONFIG_MISSING", {
      internalReason: `Hiányzó kötelező környezeti változó: ${consumerKeyName}`,
    });
  }

  const consumerSecret = raw[consumerSecretName]?.trim();
  if (!consumerSecret) {
    throw new AppError("JOB.CONFIG_MISSING", {
      internalReason: `Hiányzó kötelező környezeti változó: ${consumerSecretName}`,
    });
  }

  return {
    baseUrl: baseUrlParsed.data,
    consumerKey,
    consumerSecret,
  };
}
