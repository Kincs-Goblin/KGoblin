import { brands } from "@kg/brand-config";
import { describe, expect, it } from "vitest";

import { getBrandWooEnv, getWooBaseUrl, parseServerEnv } from "./env";
import { parseClientEnv } from "./env.client";

const gamerBrand = brands[0]!;

describe("parseServerEnv", () => {
  it("alapértelmezett KG_STORE_FIXTURES=0 értéket ad", () => {
    const env = parseServerEnv({ NODE_ENV: "test" });
    expect(env.KG_STORE_FIXTURES).toBe("0");
  });

  it("hibás KG_STORE_FIXTURES esetén érthető hibával áll meg", () => {
    expect(() => parseServerEnv({ NODE_ENV: "test", KG_STORE_FIXTURES: "invalid" })).toThrow(
      /KG_STORE_FIXTURES/,
    );
  });
});

describe("parseClientEnv", () => {
  it("alapértelmezett NEXT_PUBLIC_APP_ENV=local értéket ad", () => {
    const env = parseClientEnv({});
    expect(env.NEXT_PUBLIC_APP_ENV).toBe("local");
  });

  it("érvénytelen NEXT_PUBLIC_APP_ENV értéknél hibát dob", () => {
    expect(() => parseClientEnv({ NEXT_PUBLIC_APP_ENV: "staging-invalid" })).toThrow(
      /NEXT_PUBLIC_APP_ENV/,
    );
  });
});

describe("getWooBaseUrl & getBrandWooEnv", () => {
  it("visszaadja az érvényes Woo URL-t", () => {
    const url = getWooBaseUrl(gamerBrand, {
      NODE_ENV: "test",
      WOO_GAMER_URL: "http://localhost:8080",
    });
    expect(url).toBe("http://localhost:8080");
  });

  it("érvénytelen URL esetén a változó nevét írja ki, a hibás értéket nem szivárogtatja", () => {
    const secretLikeInvalidUrl = "not-a-valid-url-with-secret-token-12345";
    expect(() =>
      getWooBaseUrl(gamerBrand, {
        NODE_ENV: "test",
        WOO_GAMER_URL: secretLikeInvalidUrl,
      }),
    ).toThrow(/WOO_GAMER_URL/);

    try {
      getWooBaseUrl(gamerBrand, {
        NODE_ENV: "test",
        WOO_GAMER_URL: secretLikeInvalidUrl,
      });
    } catch (err) {
      expect((err as Error).message).not.toContain(secretLikeInvalidUrl);
    }
  });

  it("hiányzó REST v3 vagy webhook titoknál a hiányzó változó nevével áll meg", () => {
    expect(() =>
      getBrandWooEnv(
        gamerBrand,
        { requireRestCredentials: true },
        { NODE_ENV: "test", WOO_GAMER_URL: "http://localhost:8080" },
      ),
    ).toThrow(/WOO_GAMER_CONSUMER_KEY/);

    expect(() =>
      getBrandWooEnv(
        gamerBrand,
        { requireWebhookSecret: true },
        { NODE_ENV: "test", WOO_GAMER_URL: "http://localhost:8080" },
      ),
    ).toThrow(/WOO_GAMER_WEBHOOK_SECRET/);
  });
});
