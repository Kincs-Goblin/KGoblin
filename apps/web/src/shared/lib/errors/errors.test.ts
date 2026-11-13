import { describe, expect, it } from "vitest";

import { AppError, errorCatalog, isAppError, type ErrorCode } from "./index";

describe("errorCatalog & AppError", () => {
  it("minden katalóguskód DOMAIN.REASON formátumú és tartalmazza a kötelező mezőket", () => {
    for (const [code, entry] of Object.entries(errorCatalog)) {
      expect(code).toMatch(/^[A-Z_]+\.[A-Z_]+$/);
      expect(entry.status).toBeGreaterThanOrEqual(400);
      expect(entry.status).toBeLessThan(600);
      expect(typeof entry.retryable).toBe("boolean");
      expect(entry.message.length).toBeGreaterThan(0);
    }
  });

  it("AppError felveszi a katalógus státuszát, retryable jelzőjét és felhasználói üzenetét", () => {
    const cause = new Error("Upstream timeout");
    const err = new AppError("WOO.UNAVAILABLE", {
      cause,
      internalReason: "Store API timeout after 5000ms",
    });

    expect(isAppError(err)).toBe(true);
    expect(err.code).toBe("WOO.UNAVAILABLE");
    expect(err.status).toBe(503);
    expect(err.retryable).toBe(true);
    expect(err.userMessage).toBe(errorCatalog["WOO.UNAVAILABLE"].message);
    expect(err.message).toBe(errorCatalog["WOO.UNAVAILABLE"].message);
    expect(err.internalReason).toBe("Store API timeout after 5000ms");
    expect(err.cause).toBe(cause);
  });

  it("típusszinten elutasítja az ismeretlen hibakódokat", () => {
    const validCode: ErrorCode = "CART.OUT_OF_STOCK";
    expect(validCode).toBe("CART.OUT_OF_STOCK");

    // @ts-expect-error ismeretlen hibakód nem fordulhat le
    const invalidCode: ErrorCode = "UNKNOWN.INVALID_CODE";
    expect(invalidCode).toBeDefined();
  });
});
