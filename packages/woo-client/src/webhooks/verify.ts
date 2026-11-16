import type { Brand } from "@kg/brand-config";

import { resolveBrandWebhookSecret } from "./env";
import {
  wooOrderWebhookTopicSchema,
  wooProductWebhookTopicSchema,
  wooWebhookOrderSchema,
  wooWebhookPingSchema,
  wooWebhookProductSchema,
  type WooOrderWebhookTopic,
  type WooProductWebhookTopic,
  type WooWebhookOrderPayload,
  type WooWebhookPingPayload,
  type WooWebhookProductPayload,
} from "./schemas";

const encoder = new TextEncoder();

export type HeaderLookup = Headers | Record<string, string | string[] | undefined>;

function toBytes(input: string | Uint8Array): Uint8Array<ArrayBuffer> {
  if (typeof input === "string") {
    const encoded = encoder.encode(input);
    const buffer = new ArrayBuffer(encoded.byteLength);
    new Uint8Array(buffer).set(encoded);
    return new Uint8Array(buffer);
  }
  const buffer = new ArrayBuffer(input.byteLength);
  new Uint8Array(buffer).set(input);
  return new Uint8Array(buffer);
}

function getHeader(headers: HeaderLookup, name: string): string | undefined {
  if (headers instanceof Headers) {
    return headers.get(name) ?? undefined;
  }
  const target = name.toLowerCase();
  for (const [key, value] of Object.entries(headers)) {
    if (key.toLowerCase() === target) {
      if (Array.isArray(value)) return value[0];
      return value;
    }
  }
  return undefined;
}

function decodeBase64(value: string): Uint8Array | null {
  const trimmed = value.trim();
  if (!trimmed || !/^[A-Za-z0-9+/]+={0,2}$/.test(trimmed) || trimmed.length % 4 !== 0) {
    return null;
  }
  try {
    const binary = atob(trimmed);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) {
      bytes[i] = binary.charCodeAt(i);
    }
    return bytes;
  } catch {
    return null;
  }
}

function encodeBase64(bytes: Uint8Array): string {
  let binary = "";
  for (let i = 0; i < bytes.length; i++) {
    binary += String.fromCharCode(bytes[i]!);
  }
  return btoa(binary);
}

/**
 * Konstans idejű bájtösszehasonlítás időzítési oldalcsatorna ellen.
 */
function constantTimeEqual(a: Uint8Array, b: Uint8Array): boolean {
  const len = Math.max(a.length, b.length);
  let diff = a.length ^ b.length;
  for (let i = 0; i < len; i++) {
    const byteA = i < a.length ? a[i]! : 0;
    const byteB = i < b.length ? b[i]! : 0;
    diff |= byteA ^ byteB;
  }
  return diff === 0;
}

async function computeHmacBytes(rawBody: string | Uint8Array, secret: string): Promise<Uint8Array> {
  const key = await globalThis.crypto.subtle.importKey(
    "raw",
    toBytes(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const sigBuffer = await globalThis.crypto.subtle.sign("HMAC", key, toBytes(rawBody));
  return new Uint8Array(sigBuffer);
}

/**
 * WooCommerce `X-WC-Webhook-Signature` előállítása (base64 HMAC-SHA256).
 */
export async function computeWooWebhookSignature(
  rawBody: string | Uint8Array,
  secret: string,
): Promise<string> {
  if (!secret) {
    throw new Error("A webhook titok nem lehet üres.");
  }
  return encodeBase64(await computeHmacBytes(rawBody, secret));
}

/**
 * Ellenőrzi a `X-WC-Webhook-Signature` fejlécet a nyers kérés-törzsön, időzítésbiztos összehasonlítással.
 * Üres titok vagy hiányzó/hibás aláírás esetén mindig `false`.
 */
export async function verifyWooWebhookSignature(options: {
  rawBody: string | Uint8Array;
  signature: string | null | undefined;
  secret: string;
}): Promise<boolean> {
  if (!options.secret || !options.signature) return false;
  const provided = decodeBase64(options.signature);
  if (!provided) return false;

  const expected = await computeHmacBytes(options.rawBody, options.secret);
  return constantTimeEqual(expected, provided);
}

export type VerifiedWooWebhookEvent =
  | { topic: "ping"; payload: WooWebhookPingPayload }
  | { topic: WooProductWebhookTopic; payload: WooWebhookProductPayload }
  | { topic: WooOrderWebhookTopic; payload: WooWebhookOrderPayload };

export type VerifyWooWebhookSuccess = {
  ok: true;
  brandId: string;
  deliveryId: string | undefined;
  webhookId: string | undefined;
  event: VerifiedWooWebhookEvent;
};

export type VerifyWooWebhookFailure = {
  ok: false;
  status: 400 | 401;
  code: "WEBHOOK.INVALID_SIGNATURE" | "WEBHOOK.INVALID_PAYLOAD" | "WEBHOOK.UNSUPPORTED_TOPIC";
  /** Biztonságos, nyers payloadot és titkot nem tartalmazó hibaüzenet. */
  message: string;
};

export type VerifyWooWebhookResult = VerifyWooWebhookSuccess | VerifyWooWebhookFailure;

function parsePingBody(rawText: string): WooWebhookPingPayload | null {
  const trimmed = rawText.trim();
  if (!trimmed) return null;

  if (trimmed.startsWith("{")) {
    try {
      const json: unknown = JSON.parse(trimmed);
      const parsed = wooWebhookPingSchema.safeParse(json);
      return parsed.success ? parsed.data : null;
    } catch {
      return null;
    }
  }

  if (!/^webhook_id=\d+$/.test(trimmed)) return null;
  const parsed = wooWebhookPingSchema.safeParse({
    webhook_id: trimmed.slice("webhook_id=".length),
  });
  return parsed.success ? parsed.data : null;
}

/**
 * Közös WooCommerce webhook-ellenőrző helper `@kg/web` és `@kg/jobs` számára.
 * - Mindig ellenőrzi, hogy a brand `WOO_<BRAND>_WEBHOOK_SECRET` titka konfigurált-e (hiánynál `WooError` fail-closed).
 * - A WooCommerce mentéskor küldött aláírás nélküli `ping` kérését (`webhook_id=<szám>`, topic header nélkül)
 *   mellékhatás nélküli `ping` eseményként fogadja el; ha van aláírás fejléc, azt minden esetben ellenőrzi.
 * - Érvénytelen aláírásnál 401-et ad, a nyers payload soha nem kerül a hibába vagy a válaszba.
 */
export async function verifyAndParseWooWebhook(options: {
  brand: Brand;
  rawBody: string | Uint8Array;
  headers: HeaderLookup;
  env?: Record<string, string | undefined>;
}): Promise<VerifyWooWebhookResult> {
  const secret = resolveBrandWebhookSecret(options.brand, options.env);
  const signature = getHeader(options.headers, "x-wc-webhook-signature");
  const topic = getHeader(options.headers, "x-wc-webhook-topic")?.trim().toLowerCase();
  const deliveryId = getHeader(options.headers, "x-wc-webhook-delivery-id");
  const webhookId = getHeader(options.headers, "x-wc-webhook-id");

  const rawText =
    typeof options.rawBody === "string"
      ? options.rawBody
      : new TextDecoder().decode(options.rawBody);

  // A WooCommerce a webhook mentésekor küldött pinget (`webhook_id=N`) topic és aláírás fejléc nélkül küldi.
  if (!signature && !topic && /^webhook_id=\d+$/.test(rawText.trim())) {
    const ping = parsePingBody(rawText);
    if (ping) {
      return {
        ok: true,
        brandId: options.brand.id,
        deliveryId,
        webhookId,
        event: { topic: "ping", payload: ping },
      };
    }
  }

  const valid = await verifyWooWebhookSignature({
    rawBody: options.rawBody,
    signature,
    secret,
  });

  if (!valid) {
    return {
      ok: false,
      status: 401,
      code: "WEBHOOK.INVALID_SIGNATURE",
      message: "Érvénytelen vagy hiányzó webhook aláírás.",
    };
  }

  if (!topic || topic === "ping") {
    const ping = parsePingBody(rawText);
    if (ping) {
      return {
        ok: true,
        brandId: options.brand.id,
        deliveryId,
        webhookId,
        event: { topic: "ping", payload: ping },
      };
    }
    if (topic === "ping") {
      return {
        ok: false,
        status: 400,
        code: "WEBHOOK.INVALID_PAYLOAD",
        message: "Érvénytelen webhook ping payload.",
      };
    }
    return {
      ok: false,
      status: 400,
      code: "WEBHOOK.UNSUPPORTED_TOPIC",
      message: "Hiányzó vagy nem támogatott webhook topic.",
    };
  }

  const productTopic = wooProductWebhookTopicSchema.safeParse(topic);
  const orderTopic = wooOrderWebhookTopicSchema.safeParse(topic);

  if (!productTopic.success && !orderTopic.success) {
    return {
      ok: false,
      status: 400,
      code: "WEBHOOK.UNSUPPORTED_TOPIC",
      message: "Nem támogatott webhook topic.",
    };
  }

  let json: unknown;
  try {
    json = JSON.parse(rawText);
  } catch {
    return {
      ok: false,
      status: 400,
      code: "WEBHOOK.INVALID_PAYLOAD",
      message: "Érvénytelen JSON webhook payload.",
    };
  }

  if (productTopic.success) {
    const parsed = wooWebhookProductSchema.safeParse(json);
    if (!parsed.success) {
      return {
        ok: false,
        status: 400,
        code: "WEBHOOK.INVALID_PAYLOAD",
        message: "A termék webhook payload nem felel meg a sémának.",
      };
    }
    return {
      ok: true,
      brandId: options.brand.id,
      deliveryId,
      webhookId,
      event: { topic: productTopic.data, payload: parsed.data },
    };
  }

  const parsedOrder = wooWebhookOrderSchema.safeParse(json);
  if (!parsedOrder.success) {
    return {
      ok: false,
      status: 400,
      code: "WEBHOOK.INVALID_PAYLOAD",
      message: "A rendelés webhook payload nem felel meg a sémának.",
    };
  }

  return {
    ok: true,
    brandId: options.brand.id,
    deliveryId,
    webhookId,
    event: { topic: orderTopic.data!, payload: parsedOrder.data },
  };
}
