import { brands } from "@kg/brand-config";
import { describe, expect, it } from "vitest";

import {
  computeWooWebhookSignature,
  verifyAndParseWooWebhook,
  verifyWooWebhookSignature,
} from "./index";

const gamerBrand = brands[0]!;

describe("verifyWooWebhookSignature", () => {
  it("elfogadja a helyes HMAC-SHA256 base64 aláírást a nyers bodyn", async () => {
    const rawBody = JSON.stringify({ id: 42, slug: "gamer-billentyuzet" });
    const secret = "whsec_gamer_secret_123";
    const signature = await computeWooWebhookSignature(rawBody, secret);

    await expect(verifyWooWebhookSignature({ rawBody, signature, secret })).resolves.toBe(true);
  });

  it("elutasítja a módosított bodyt, a rossz titkot, a hiányzó aláírást és a hibás base64-et", async () => {
    const rawBody = JSON.stringify({ id: 42 });
    const secret = "whsec_gamer_secret_123";
    const signature = await computeWooWebhookSignature(rawBody, secret);

    await expect(
      verifyWooWebhookSignature({
        rawBody: JSON.stringify({ id: 43 }),
        signature,
        secret,
      }),
    ).resolves.toBe(false);

    await expect(
      verifyWooWebhookSignature({
        rawBody,
        signature,
        secret: "whsec_other_brand_secret",
      }),
    ).resolves.toBe(false);

    await expect(
      verifyWooWebhookSignature({ rawBody, signature: undefined, secret }),
    ).resolves.toBe(false);

    await expect(
      verifyWooWebhookSignature({ rawBody, signature: "not-valid-base64!!!", secret }),
    ).resolves.toBe(false);

    await expect(verifyWooWebhookSignature({ rawBody, signature, secret: "" })).resolves.toBe(
      false,
    );
  });
});

describe("verifyAndParseWooWebhook", () => {
  it("érvénytelen aláírásra 401-et ad, a nyers payload és a titok nélkül", async () => {
    const secret = "whsec_super_secret_token";
    const piiPayload = JSON.stringify({
      id: 99,
      status: "processing",
      billing: { first_name: "Titkos", email: "titkos@example.com" },
    });

    const result = await verifyAndParseWooWebhook({
      brand: gamerBrand,
      rawBody: piiPayload,
      headers: {
        "x-wc-webhook-topic": "order.created",
        "x-wc-webhook-signature": "invalid==",
      },
      env: { WOO_GAMER_WEBHOOK_SECRET: secret },
    });

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.status).toBe(401);
      expect(result.code).toBe("WEBHOOK.INVALID_SIGNATURE");
      expect(result.message).not.toContain("Titkos");
      expect(result.message).not.toContain(secret);
    }
  });

  it("kezeli a Woo aláírás nélküli és aláírt ping kérését, és elutasítja a manipulált pinget", async () => {
    const secret = "whsec_ping_test";

    // Valódi WooCommerce mentéskori ping: nincs sem X-WC-Webhook-Signature, sem X-WC-Webhook-Topic header
    const unsignedPing = await verifyAndParseWooWebhook({
      brand: gamerBrand,
      rawBody: "webhook_id=17",
      headers: { "content-type": "application/x-www-form-urlencoded" },
      env: { WOO_GAMER_WEBHOOK_SECRET: secret },
    });
    expect(unsignedPing.ok).toBe(true);
    if (unsignedPing.ok && unsignedPing.event.topic === "ping") {
      expect(unsignedPing.event.payload.webhook_id).toBe(17);
    }

    // Ha extra mező vagy topic van aláírás nélkül: 401
    const extraUnsigned = await verifyAndParseWooWebhook({
      brand: gamerBrand,
      rawBody: "webhook_id=17&extra=1",
      headers: {},
      env: { WOO_GAMER_WEBHOOK_SECRET: secret },
    });
    expect(extraUnsigned.ok).toBe(false);
    if (!extraUnsigned.ok) expect(extraUnsigned.status).toBe(401);

    // Ha van aláírás fejléc, de hibás: 401 ping bodynál is
    const badSigPing = await verifyAndParseWooWebhook({
      brand: gamerBrand,
      rawBody: "webhook_id=17",
      headers: { "X-WC-Webhook-Signature": "invalid==" },
      env: { WOO_GAMER_WEBHOOK_SECRET: secret },
    });
    expect(badSigPing.ok).toBe(false);
    if (!badSigPing.ok) expect(badSigPing.status).toBe(401);

    const jsonBody = JSON.stringify({ webhook_id: 18 });
    const jsonSig = await computeWooWebhookSignature(jsonBody, secret);
    const jsonResult = await verifyAndParseWooWebhook({
      brand: gamerBrand,
      rawBody: jsonBody,
      headers: new Headers({
        "x-wc-webhook-topic": "ping",
        "x-wc-webhook-signature": jsonSig,
      }),
      env: { WOO_GAMER_WEBHOOK_SECRET: secret },
    });
    expect(jsonResult.ok).toBe(true);
  });

  it("hiányzó WOO_<BRAND>_WEBHOOK_SECRET esetén a változó nevével áll le (fail-closed)", async () => {
    await expect(
      verifyAndParseWooWebhook({
        brand: gamerBrand,
        rawBody: "webhook_id=17",
        headers: {},
        env: {},
      }),
    ).rejects.toThrowError(/WOO_GAMER_WEBHOOK_SECRET/);
  });

  it("validálja a product.* és order.created/updated eseményeket és eldobja a PII mezőket", async () => {
    const secret = "whsec_events_secret";
    const productBody = JSON.stringify({
      id: 24,
      name: "Monitor Lámpa",
      slug: "monitor-lampa",
      status: "publish",
      categories: [{ id: 18, slug: "ergonomia" }],
    });
    const productSig = await computeWooWebhookSignature(productBody, secret);

    const productResult = await verifyAndParseWooWebhook({
      brand: gamerBrand,
      rawBody: productBody,
      headers: {
        "x-wc-webhook-topic": "product.updated",
        "x-wc-webhook-signature": productSig,
        "x-wc-webhook-delivery-id": "del-1",
      },
      env: { WOO_GAMER_WEBHOOK_SECRET: secret },
    });

    expect(productResult.ok).toBe(true);
    if (productResult.ok && productResult.event.topic === "product.updated") {
      expect(productResult.event.payload.id).toBe(24);
      expect(productResult.deliveryId).toBe("del-1");
    }

    const orderBody = JSON.stringify({
      id: 500,
      number: "500",
      status: "processing",
      currency: "HUF",
      total: "16990",
      billing: {
        first_name: "Kovács",
        last_name: "János",
        email: "kovacs@example.com",
        phone: "+36301112233",
      },
    });
    const orderSig = await computeWooWebhookSignature(orderBody, secret);

    const orderResult = await verifyAndParseWooWebhook({
      brand: gamerBrand,
      rawBody: orderBody,
      headers: {
        "x-wc-webhook-topic": "order.created",
        "x-wc-webhook-signature": orderSig,
      },
      env: { WOO_GAMER_WEBHOOK_SECRET: secret },
    });

    expect(orderResult.ok).toBe(true);
    if (orderResult.ok && orderResult.event.topic === "order.created") {
      expect(orderResult.event.payload.id).toBe(500);
      expect("billing" in orderResult.event.payload).toBe(false);
    }
  });

  it("egyik brand titka nem fogadja el a másik brand webhookját", async () => {
    const brandB = structuredClone(gamerBrand);
    brandB.id = "masik";

    const rawBody = JSON.stringify({ id: 24 });
    const sigA = await computeWooWebhookSignature(rawBody, "whsec_a");

    const result = await verifyAndParseWooWebhook({
      brand: brandB,
      rawBody,
      headers: {
        "x-wc-webhook-topic": "product.updated",
        "x-wc-webhook-signature": sigA,
      },
      env: {
        WOO_GAMER_WEBHOOK_SECRET: "whsec_a",
        WOO_MASIK_WEBHOOK_SECRET: "whsec_b",
      },
    });

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.status).toBe(401);
    }
  });
});
