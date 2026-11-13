import { describe, expect, it } from "vitest";

import { getBrandWooCredentials, parseJobsEnv } from "./env";
import { AppError, isAppError, jobErrorCatalog, type JobErrorCode } from "./errors";
import { buildBrandIdempotencyKey, runBrandHeartbeat } from "./heartbeat";

describe("jobs domain: buildBrandIdempotencyKey & runBrandHeartbeat", () => {
  it("brand-előtagú idempotencia-kulcsot épít és validálja a gamer brandet", () => {
    const res = runBrandHeartbeat({
      brandId: "gamer",
      correlationId: "evt_001",
    });

    expect(res).toEqual({
      ok: true,
      brandId: "gamer",
      brandName: "KincsGoblin",
      idempotencyKey: "brand-heartbeat:gamer:evt_001",
      searchIndex: "products_gamer",
    });
  });

  it("ismeretlen brand-azonosítóra BRAND.UNKNOWN_ID AppErrort dob (retryable: false)", () => {
    try {
      runBrandHeartbeat({ brandId: "unknown-brand", correlationId: "evt_002" });
      expect.unreachable("Hibát kellett volna dobnia");
    } catch (error) {
      expect(isAppError(error)).toBe(true);
      if (isAppError(error)) {
        expect(error.code).toBe("BRAND.UNKNOWN_ID");
        expect(error.retryable).toBe(false);
        expect(error.status).toBe(400);
      }
    }
  });

  it("üres idempotencia-kulcs komponens esetén JOB.INVALID_PAYLOAD hibát dob", () => {
    expect(() => buildBrandIdempotencyKey("forward-order", "gamer", "   ")).toThrow(AppError);
  });

  it("típusszinten elutasítja az ismeretlen job-hibakódot", () => {
    const valid: JobErrorCode = "SUPPLIER.FEED_INVALID";
    expect(jobErrorCatalog[valid].status).toBe(422);

    // @ts-expect-error ismeretlen hibakód nem fordulhat le
    const invalid: JobErrorCode = "SUPPLIER.NON_EXISTENT";
    expect(invalid).toBeDefined();
  });
});

describe("jobs domain: parseJobsEnv & getBrandWooCredentials", () => {
  it("üres környezetben is érvényes opcionális konfigurációt ad vissza", () => {
    const env = parseJobsEnv({ NODE_ENV: "test" });
    expect(env.TRIGGER_SECRET_KEY).toBeUndefined();
    expect(env.SENTRY_DSN).toBeUndefined();
  });

  it("érvénytelen SENTRY_DSN URL esetén érthető hibát dob", () => {
    expect(() => parseJobsEnv({ NODE_ENV: "test", SENTRY_DSN: "not-a-url" })).toThrow(/SENTRY_DSN/);
  });

  it("feloldja a brand Woo REST v3 hitelesítő adatait, hiányzónál pedig a változó nevét jelzi", () => {
    const creds = getBrandWooCredentials("gamer", {
      NODE_ENV: "test",
      WOO_GAMER_URL: "http://localhost:8080",
      WOO_GAMER_CONSUMER_KEY: "ck_test",
      WOO_GAMER_CONSUMER_SECRET: "cs_test",
    });
    expect(creds.baseUrl).toBe("http://localhost:8080");
    expect(creds.consumerKey).toBe("ck_test");

    expect(() =>
      getBrandWooCredentials("gamer", {
        NODE_ENV: "test",
        WOO_GAMER_URL: "http://localhost:8080",
      }),
    ).toThrow(/WOO_GAMER_CONSUMER_KEY/);
  });
});
