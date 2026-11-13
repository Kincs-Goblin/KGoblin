import { AbortTaskRunError } from "@trigger.dev/sdk";
import { describe, expect, it } from "vitest";

import { handleTaskError } from "../adapters/telemetry";
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

  it("handleTaskError nem újrapróbálható AppError esetén skipRetrying: true és AbortTaskRunError választ ad", () => {
    const nonRetryable = new AppError("BRAND.UNKNOWN_ID");
    const result = handleTaskError({
      error: nonRetryable,
      ctx: { task: { id: "brand-heartbeat" }, run: { id: "run_123" } },
      payload: { brandId: "unknown" },
    });

    expect(result?.skipRetrying).toBe(true);
    expect(result?.error).toBeInstanceOf(AbortTaskRunError);

    const retryable = new AppError("WOO.UNAVAILABLE");
    expect(
      handleTaskError({
        error: retryable,
        ctx: { task: { id: "brand-heartbeat" }, run: { id: "run_123" } },
      }),
    ).toBeUndefined();
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
  it("hiányzó TRIGGER_PROJECT_ID esetén érthető hibával áll meg", () => {
    expect(() => parseJobsEnv({ NODE_ENV: "test" })).toThrow(/TRIGGER_PROJECT_ID/);
  });

  it("érvényes TRIGGER_PROJECT_ID esetén visszaadja a konfigurációt", () => {
    const env = parseJobsEnv({ NODE_ENV: "test", TRIGGER_PROJECT_ID: "proj_kgoblin_test" });
    expect(env.TRIGGER_PROJECT_ID).toBe("proj_kgoblin_test");
  });

  it("érvénytelen TRIGGER_PROJECT_ID formátumnál érthető hibát dob", () => {
    expect(() => parseJobsEnv({ NODE_ENV: "test", TRIGGER_PROJECT_ID: "invalid_id" })).toThrow(
      /TRIGGER_PROJECT_ID/,
    );
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
