import "server-only";

import { getCloudflareContext } from "@opennextjs/cloudflare";
import type { NextRequest } from "next/server";
import type { z } from "zod";

/** A `wrangler.jsonc` `ratelimits` bindingjának neve és ablaka (ADR-0018); a kettőnek egyeznie kell. */
export const CART_RATE_LIMIT_BINDING = "CART_RATE_LIMITER";
export const CART_RATE_LIMIT_PERIOD_SECONDS = 60;
const DEFAULT_RATE_LIMIT_MAX = 60;
const DEFAULT_RATE_LIMIT_WINDOW_MS = CART_RATE_LIMIT_PERIOD_SECONDS * 1000;
const MAX_RATE_LIMIT_KEYS = 2000;
const DEFAULT_MAX_JSON_BODY_BYTES = 16 * 1024;

export type BffRateLimitDecision =
  { allowed: true } | { allowed: false; retryAfterSeconds: number };

/** Kulcsonkénti (`<brand>:<kliens-IP>`) rate limit döntés. */
export type BffRateLimiter = (key: string) => Promise<BffRateLimitDecision>;

export type BffRateLimitOptions = {
  now?: () => number;
  /** Felülírja a Workers binding / memóriabeli tartalék választását (teszt). */
  rateLimiter?: BffRateLimiter;
  /** A memóriabeli tartalék limiter paraméterei. */
  rateLimit?: {
    maxRequests: number;
    windowMs: number;
  };
};

/** A Workers Rate Limiting binding felülete (`ratelimits` a `wrangler.jsonc`-ben). */
type RateLimitBinding = {
  limit(options: { key: string }): Promise<{ success: boolean }>;
};

function isRateLimitBinding(value: unknown): value is RateLimitBinding {
  return (
    typeof value === "object" &&
    value !== null &&
    typeof (value as { limit?: unknown }).limit === "function"
  );
}

/**
 * A Workers Rate Limiting binding, ha a kérés Cloudflare Workersen fut. Máshol (`next dev`,
 * `next start`, Vitest) nincs Cloudflare-kontextus, ilyenkor csendben `undefined`. Ha van
 * Cloudflare-kontextus, de hiányzik a binding, az konfigurációs hiba: naplózzuk, és a tartalék fut.
 */
function getRateLimitBinding(): RateLimitBinding | undefined {
  let env: Record<string, unknown>;
  try {
    env = getCloudflareContext().env as unknown as Record<string, unknown>;
  } catch {
    return undefined;
  }
  const binding = env[CART_RATE_LIMIT_BINDING];
  if (isRateLimitBinding(binding)) return binding;
  console.error("[bff-guard] Hiányzó rate limit binding, memóriabeli tartalék fut", {
    binding: CART_RATE_LIMIT_BINDING,
  });
  return undefined;
}

/**
 * Memóriabeli csúszóablakos tartalék limiter. Csak ott fut, ahol nincs Workers binding (helyi
 * fejlesztés, teszt, `next start` e2e); Workersen az izolátumok miatt nem korlátozna érdemben.
 * Felső kulcsszámmal védett a memória-kimerítés ellen.
 */
const rateLimitStore = new Map<string, number[]>();

export function resetBffRateLimiter(): void {
  rateLimitStore.clear();
}

export function bffNoStoreHeaders(extra?: Record<string, string>): Record<string, string> {
  return {
    "Cache-Control": "no-store",
    Vary: "Host, Cookie",
    ...extra,
  };
}

export function isSecureBffCookie(request: NextRequest, override?: boolean): boolean {
  if (override !== undefined) return override;
  const appEnv = process.env.NEXT_PUBLIC_APP_ENV;
  if (appEnv === "production" || appEnv === "demo" || appEnv === "preview") return true;
  const forwardedProto = request.headers.get("x-forwarded-proto")?.split(",")[0]?.trim();
  return forwardedProto === "https" || request.nextUrl.protocol === "https:";
}

/**
 * A rate limit kulcsához használt kliens-IP. Élesben csak a Cloudflare által beállított
 * `cf-connecting-ip` hiteles; a hamisítható `x-forwarded-for` és a közös `local` vödör kizárólag
 * helyi környezetben használható. Hiányzó IP-nél a kérések egy közös `unknown` vödörbe esnek
 * (fail-closed: inkább korlátozunk, mint hogy kulcs nélkül átengedjünk).
 */
export function getBffClientIp(request: NextRequest): string {
  const cfIp = request.headers.get("cf-connecting-ip")?.trim();
  if (cfIp) return cfIp;
  if (process.env.NEXT_PUBLIC_APP_ENV !== "local") return "unknown";
  const forwarded = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim();
  if (forwarded) return forwarded;
  return "local";
}

function checkMemoryRateLimit(
  key: string,
  nowMs: number,
  maxRequests: number,
  windowMs: number,
): BffRateLimitDecision {
  const cutoff = nowMs - windowMs;
  const existing = (rateLimitStore.get(key) ?? []).filter((ts) => ts > cutoff);

  if (existing.length >= maxRequests) {
    const oldest = existing[0] ?? nowMs;
    const retryAfterSeconds = Math.max(1, Math.ceil((oldest + windowMs - nowMs) / 1000));
    rateLimitStore.set(key, existing);
    return { allowed: false, retryAfterSeconds };
  }

  existing.push(nowMs);
  rateLimitStore.delete(key);
  rateLimitStore.set(key, existing);

  if (rateLimitStore.size > MAX_RATE_LIMIT_KEYS) {
    for (const [entryKey, timestamps] of rateLimitStore.entries()) {
      const fresh = timestamps.filter((ts) => ts > cutoff);
      if (fresh.length === 0) {
        rateLimitStore.delete(entryKey);
      } else {
        rateLimitStore.set(entryKey, fresh);
      }
    }
    while (rateLimitStore.size > MAX_RATE_LIMIT_KEYS) {
      const oldestKey = rateLimitStore.keys().next().value;
      if (oldestKey === undefined) break;
      rateLimitStore.delete(oldestKey);
    }
  }

  return { allowed: true };
}

function createMemoryRateLimiter(options?: BffRateLimitOptions): BffRateLimiter {
  const maxRequests = options?.rateLimit?.maxRequests ?? DEFAULT_RATE_LIMIT_MAX;
  const windowMs = options?.rateLimit?.windowMs ?? DEFAULT_RATE_LIMIT_WINDOW_MS;
  return async (key) =>
    checkMemoryRateLimit(key, options?.now?.() ?? Date.now(), maxRequests, windowMs);
}

function createBindingRateLimiter(binding: RateLimitBinding): BffRateLimiter {
  return async (key) => {
    const { success } = await binding.limit({ key });
    return success
      ? { allowed: true }
      : { allowed: false, retryAfterSeconds: CART_RATE_LIMIT_PERIOD_SECONDS };
  };
}

function resolveRateLimiter(options?: BffRateLimitOptions): BffRateLimiter {
  if (options?.rateLimiter) return options.rateLimiter;
  const binding = getRateLimitBinding();
  return binding ? createBindingRateLimiter(binding) : createMemoryRateLimiter(options);
}

/**
 * Fail-open: ha maga a limiter hibázik (pl. a binding kivételt dob), naplózunk és a memóriabeli
 * tartalékra esünk vissza (ADR-0018).
 */
export async function checkBffRateLimit(
  key: string,
  options?: BffRateLimitOptions,
): Promise<BffRateLimitDecision> {
  try {
    return await resolveRateLimiter(options)(key);
  } catch {
    console.error("[bff-guard] Rate limiter hiba, memóriabeli tartalék fut");
    return createMemoryRateLimiter(options)(key);
  }
}

/**
 * Méretkorlátos body-olvasás stream-szinten: előszűr a `Content-Length` fejlécre, majd chunkonként
 * olvas, és túllépésnél azonnal megszakítja (`reader.cancel()`) a streamet, hogy egy nagy kérés ne
 * meríthesse ki a Workers izolátum memóriáját.
 */
export async function readBoundedRequestBody(
  request: Request,
  maxBytes: number,
): Promise<{ ok: true; text: string } | { ok: false }> {
  const contentLength = request.headers.get("content-length");
  if (contentLength) {
    const declared = Number(contentLength);
    if (Number.isFinite(declared) && declared > maxBytes) {
      return { ok: false };
    }
  }

  if (!request.body) {
    return { ok: true, text: "" };
  }

  const reader = request.body.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      total += value.byteLength;
      if (total > maxBytes) {
        await reader.cancel().catch(() => {});
        return { ok: false };
      }
      chunks.push(value);
    }
  } catch {
    return { ok: false };
  }

  const merged = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) {
    merged.set(chunk, offset);
    offset += chunk.byteLength;
  }

  return { ok: true, text: new TextDecoder().decode(merged) };
}

/**
 * CSRF-védelem a mutáló kérésekre: az `Origin` kötelező, és a kérés hostjával kell egyeznie. A modern
 * böngészők same-origin POST/PATCH/DELETE `fetch`-nél is küldik; hiánya nem böngészős vagy hamisított
 * kérésre utal.
 */
export function isMutatingOriginAllowed(request: NextRequest): boolean {
  const origin = request.headers.get("origin");
  if (!origin) return false;
  const host = request.headers.get("host")?.trim().toLowerCase();
  if (!host) return false;
  try {
    return new URL(origin).host.toLowerCase() === host;
  } catch {
    return false;
  }
}

export async function parseBoundedJsonBody<T extends z.ZodType>(
  request: NextRequest,
  schema: T,
  maxBytes = DEFAULT_MAX_JSON_BODY_BYTES,
): Promise<{ ok: true; data: z.infer<T> } | { ok: false }> {
  // Pontos médiatípus-egyezés: a CORS-safelisted `text/plain; application/json` forma nem mehet át.
  const mediaType = request.headers.get("content-type")?.split(";")[0]?.trim().toLowerCase();
  if (mediaType !== "application/json") {
    return { ok: false };
  }

  const bodyResult = await readBoundedRequestBody(request, maxBytes);
  if (!bodyResult.ok) {
    return { ok: false };
  }

  let raw: unknown;
  try {
    raw = JSON.parse(bodyResult.text);
  } catch {
    return { ok: false };
  }
  const parsed = schema.safeParse(raw);
  if (!parsed.success) return { ok: false };
  return { ok: true, data: parsed.data };
}
