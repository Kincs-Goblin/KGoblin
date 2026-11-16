import { brands } from "@kg/brand-config";
import { computeWooWebhookSignature } from "@kg/woo-client/webhooks";
import { describe, expect, it, vi } from "vitest";

import { handleWooWebhookRequest } from "./woo-webhook";

const gamerBrand = brands[0]!;
const otherBrand = { ...structuredClone(gamerBrand), id: "masik" };

const resolveBrand = (id: string) =>
  id === gamerBrand.id ? gamerBrand : id === otherBrand.id ? otherBrand : undefined;

describe("handleWooWebhookRequest", () => {
  it("érvénytelen aláírásra 401-et ad, és nem hívja a revalidate-et", async () => {
    const revalidate = vi.fn();
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
    const secret = "whsec_gamer_secret";

    const request = new Request("http://localhost:3000/api/webhooks/woo/gamer", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-WC-Webhook-Topic": "product.updated",
        "X-WC-Webhook-Signature": "rossz-alairas==",
      },
      body: JSON.stringify({ id: 18, slug: "apexstrike-pro" }),
    });

    const response = await handleWooWebhookRequest(request, "gamer", {
      revalidate,
      resolveBrand,
      env: { WOO_GAMER_WEBHOOK_SECRET: secret },
    });

    expect(response.status).toBe(401);
    expect(revalidate).not.toHaveBeenCalled();
    expect(warnSpy).toHaveBeenCalledWith("[woo-webhook] elutasított kérés", {
      brandId: "gamer",
      status: 401,
      code: "WEBHOOK.INVALID_SIGNATURE",
    });
    warnSpy.mockRestore();
  });

  it("egyik brand aláírásával nem fogadja el a másik brand végpontja (401)", async () => {
    const revalidate = vi.fn();
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
    const body = JSON.stringify({ id: 18, slug: "apexstrike-pro" });
    const sigGamer = await computeWooWebhookSignature(body, "whsec_gamer");

    const request = new Request("http://localhost:3000/api/webhooks/woo/masik", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-WC-Webhook-Topic": "product.updated",
        "X-WC-Webhook-Signature": sigGamer,
      },
      body,
    });

    const response = await handleWooWebhookRequest(request, "masik", {
      revalidate,
      resolveBrand,
      env: {
        WOO_GAMER_WEBHOOK_SECRET: "whsec_gamer",
        WOO_MASIK_WEBHOOK_SECRET: "whsec_masik",
      },
    });

    expect(response.status).toBe(401);
    expect(revalidate).not.toHaveBeenCalled();
    warnSpy.mockRestore();
  });

  it("érvényes product.updated webhooknál csak a célbrand tagjeit revalidálja idempotensen", async () => {
    const revalidate = vi.fn();
    const body = JSON.stringify({
      id: 18,
      parent_id: 63,
      slug: "apexstrike-pro",
      categories: [{ id: 16, slug: "gamer-periferiak" }],
    });
    const sig = await computeWooWebhookSignature(body, "whsec_gamer");

    const makeReq = () =>
      new Request("http://localhost:3000/api/webhooks/woo/gamer", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-WC-Webhook-Topic": "product.updated",
          "X-WC-Webhook-Signature": sig,
        },
        body,
      });

    const first = await handleWooWebhookRequest(makeReq(), "gamer", {
      revalidate,
      resolveBrand,
      env: { WOO_GAMER_WEBHOOK_SECRET: "whsec_gamer" },
    });
    const firstJson = (await first.json()) as { ok: boolean; revalidated: string[] };

    expect(first.status).toBe(200);
    expect(firstJson.ok).toBe(true);
    expect(firstJson.revalidated).toEqual(
      expect.arrayContaining([
        "gamer:catalog",
        "gamer:product:18",
        "gamer:product:63",
        "gamer:product-slug:apexstrike-pro",
        "gamer:category:16",
      ]),
    );
    expect(firstJson.revalidated.every((tag) => tag.startsWith("gamer:"))).toBe(true);

    // Ismételt kézbesítés idempotensen ugyanúgy 200
    const second = await handleWooWebhookRequest(makeReq(), "gamer", {
      revalidate,
      resolveBrand,
      env: { WOO_GAMER_WEBHOOK_SECRET: "whsec_gamer" },
    });
    expect(second.status).toBe(200);
    expect(revalidate).toHaveBeenCalledTimes(10);
  });

  it("kategória webhooknál (<brand>:catalog + <brand>:category:<id>) és pingnél helyesen válaszol", async () => {
    const revalidate = vi.fn();
    const catBody = JSON.stringify({ action: "edited_product_cat", arg: 16 });
    const catSig = await computeWooWebhookSignature(catBody, "whsec_gamer");

    const catRes = await handleWooWebhookRequest(
      new Request("http://localhost:3000/api/webhooks/woo/gamer", {
        method: "POST",
        headers: {
          "X-WC-Webhook-Topic": "action.edited_product_cat",
          "X-WC-Webhook-Signature": catSig,
        },
        body: catBody,
      }),
      "gamer",
      { revalidate, resolveBrand, env: { WOO_GAMER_WEBHOOK_SECRET: "whsec_gamer" } },
    );

    expect(catRes.status).toBe(200);
    expect(revalidate).toHaveBeenCalledWith("gamer:catalog");
    expect(revalidate).toHaveBeenCalledWith("gamer:category:16");

    const pingRes = await handleWooWebhookRequest(
      new Request("http://localhost:3000/api/webhooks/woo/gamer", {
        method: "POST",
        body: "webhook_id=1",
      }),
      "gamer",
      { revalidate, resolveBrand, env: { WOO_GAMER_WEBHOOK_SECRET: "whsec_gamer" } },
    );
    expect(pingRes.status).toBe(200);
    expect(revalidate).toHaveBeenCalledTimes(2);
  });

  it("ismeretlen brand esetén 404-et ad", async () => {
    const revalidate = vi.fn();
    const res = await handleWooWebhookRequest(
      new Request("http://localhost:3000/api/webhooks/woo/nincs", { method: "POST", body: "{}" }),
      "nincs",
      { revalidate, resolveBrand, env: {} },
    );
    expect(res.status).toBe(404);
    expect(revalidate).not.toHaveBeenCalled();
  });

  it("1 MiB-nál nagyobb törzs esetén 413-at ad és nem pufferel / revalidál", async () => {
    const revalidate = vi.fn();
    const oversized = "x".repeat(1024 * 1024 + 10);
    const res = await handleWooWebhookRequest(
      new Request("http://localhost:3000/api/webhooks/woo/gamer", {
        method: "POST",
        body: oversized,
      }),
      "gamer",
      { revalidate, resolveBrand, env: { WOO_GAMER_WEBHOOK_SECRET: "whsec_gamer" } },
    );
    expect(res.status).toBe(413);
    expect(revalidate).not.toHaveBeenCalled();
  });
});
