import { z } from "zod";

const clientEnvSchema = z.object({
  /** Publikus futási környezet (local | preview | demo | production). */
  NEXT_PUBLIC_APP_ENV: z.enum(["local", "preview", "demo", "production"]).default("local"),
  /** Sentry publikus DSN (opcionális a M5 mérföldkőig). */
  NEXT_PUBLIC_SENTRY_DSN: z.string().url().optional(),
});

/**
 * Kliensoldali env-séma validálása. Értéket soha nem írunk ki a hibába, csak a mezőnevet és az okot.
 */
export function parseClientEnv(raw: Record<string, string | undefined>) {
  const normalized = {
    NEXT_PUBLIC_APP_ENV: raw.NEXT_PUBLIC_APP_ENV || undefined,
    NEXT_PUBLIC_SENTRY_DSN: raw.NEXT_PUBLIC_SENTRY_DSN || undefined,
  };
  const result = clientEnvSchema.safeParse(normalized);
  if (!result.success) {
    const issues = result.error.issues
      .map((issue) => `${issue.path.join(".") || "env"}: ${issue.message}`)
      .join("; ");
    throw new Error(`Invalid client environment configuration (${issues})`);
  }
  return result.data;
}

export const clientEnv = parseClientEnv({
  NEXT_PUBLIC_APP_ENV: process.env.NEXT_PUBLIC_APP_ENV,
  NEXT_PUBLIC_SENTRY_DSN: process.env.NEXT_PUBLIC_SENTRY_DSN,
});
