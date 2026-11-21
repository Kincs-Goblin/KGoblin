import "server-only";

import { getBrandById, type Brand } from "@kg/brand-config";
import { getBrandEnvPrefix } from "@kg/woo-client";
import { verifyAndParseWooWebhook, type VerifiedWooWebhookEvent } from "@kg/woo-client/webhooks";
import { NextResponse } from "next/server";

import { serverEnv } from "../config/env";
import type { ErrorCode } from "../lib/errors";
import { cacheTags } from "./cache-tags";

export type WooWebhookDependencies = {
  revalidate: (tag: string) => void;
  env?: Record<string, string | undefined>;
  resolveBrand?: (brandId: string) => Brand | undefined;
  /** Alapból a buildkor beégetett `NEXT_PUBLIC_APP_ENV`. */
  appEnv?: string;
};

/** A seed lokális alapértelmezett titka nyilvános, ezért nem lokális környezetben nem fogadható el. */
const LOCAL_DEFAULT_SECRET_PREFIX = "kg_local_";
/** Izolátumonként egyszer naplózunk, hogy aláíratlan kérésekkel ne lehessen teleírni a logot. */
let loggedLocalSecretMisconfig = false;

function webhookError(code: ErrorCode, status: number, message: string) {
  return NextResponse.json({ ok: false, code, message }, { status });
}

export function collectWebhookCacheTags(brandId: string, event: VerifiedWooWebhookEvent): string[] {
  switch (event.topic) {
    case "ping":
    case "order.created":
    case "order.updated":
      return [];
    case "product.created":
    case "product.updated":
    case "product.deleted":
    case "product.restored": {
      const tags = new Set<string>([cacheTags.catalog(brandId)]);
      if (event.payload.slug) {
        tags.add(cacheTags.productSlug(brandId, event.payload.slug));
      }
      for (const category of event.payload.categories) {
        tags.add(cacheTags.category(brandId, category.id));
      }
      return [...tags];
    }
    case "action.created_product_cat":
    case "action.edited_product_cat":
    case "action.delete_product_cat":
    case "category.created":
    case "category.updated":
    case "category.deleted":
      return [cacheTags.catalog(brandId), cacheTags.category(brandId, event.payload.categoryId)];
  }
}

const MAX_WEBHOOK_BODY_BYTES = 1024 * 1024; // 1 MiB

async function readBoundedBody(
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

  const merged = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) {
    merged.set(chunk, offset);
    offset += chunk.byteLength;
  }

  return { ok: true, text: new TextDecoder().decode(merged) };
}

export async function handleWooWebhookRequest(
  request: Request,
  brandId: string,
  deps: WooWebhookDependencies,
): Promise<NextResponse> {
  const brand = (deps.resolveBrand ?? getBrandById)(brandId);
  if (!brand) {
    return webhookError("BRAND.UNKNOWN_ID", 404, "Ismeretlen brand-azonosító.");
  }

  const env = deps.env ?? process.env;
  const appEnv = deps.appEnv ?? serverEnv.NEXT_PUBLIC_APP_ENV;
  const secret = env[`${getBrandEnvPrefix(brand)}_WEBHOOK_SECRET`]?.trim() ?? "";
  if (appEnv !== "local" && secret.startsWith(LOCAL_DEFAULT_SECRET_PREFIX)) {
    if (!loggedLocalSecretMisconfig) {
      loggedLocalSecretMisconfig = true;
      console.error("[woo-webhook] konfigurációs hiba", {
        brandId: brand.id,
        message: "Lokális alapértelmezett webhook-titok nem lokális környezetben.",
      });
    }
    return webhookError("WEBHOOK.CONFIG_ERROR", 500, "Webhook konfigurációs hiba.");
  }

  const bodyResult = await readBoundedBody(request, MAX_WEBHOOK_BODY_BYTES);
  if (!bodyResult.ok) {
    return webhookError("WEBHOOK.PAYLOAD_TOO_LARGE", 413, "Túl nagy webhook kérés.");
  }
  const rawBody = bodyResult.text;

  let verified;
  try {
    verified = await verifyAndParseWooWebhook({
      brand,
      rawBody,
      headers: request.headers,
      env,
    });
  } catch (error) {
    console.error("[woo-webhook] konfigurációs hiba", {
      brandId: brand.id,
      message: error instanceof Error ? error.message : "Ismeretlen hiba",
    });
    return webhookError("WEBHOOK.CONFIG_ERROR", 500, "Webhook konfigurációs hiba.");
  }

  if (!verified.ok) {
    console.warn("[woo-webhook] elutasított kérés", {
      brandId: brand.id,
      status: verified.status,
      code: verified.code,
    });
    return NextResponse.json(
      { ok: false, code: verified.code, message: verified.message },
      { status: verified.status },
    );
  }

  const revalidated = collectWebhookCacheTags(brand.id, verified.event);
  for (const tag of revalidated) {
    deps.revalidate(tag);
  }

  return NextResponse.json({
    ok: true,
    brand: brand.id,
    topic: verified.event.topic,
    revalidated,
  });
}
