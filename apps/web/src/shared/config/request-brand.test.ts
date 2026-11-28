import { NextRequest } from "next/server";
import { afterEach, describe, expect, it, vi } from "vitest";

import { resolveRequestBrand } from "./request-brand";

describe("resolveRequestBrand", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("csak a Host fejlécből oldja fel a regisztrált brandet, a hamisítható X-Forwarded-Host fejlécet figyelmen kívül hagyja", () => {
    expect(
      resolveRequestBrand(
        new NextRequest("http://gamer.localhost:3000/api/cart", {
          headers: { host: "gamer.localhost:3000" },
        }),
      )?.id,
    ).toBe("gamer");

    expect(
      resolveRequestBrand(
        new NextRequest("http://www.gamer.localhost:3000/api/cart", {
          headers: { host: "www.gamer.localhost:3000" },
        }),
      )?.id,
    ).toBe("gamer");

    expect(
      resolveRequestBrand(
        new NextRequest("http://unknown.example.test/api/cart", {
          headers: {
            host: "unknown.example.test",
            "x-forwarded-host": "gamer.localhost:3000",
          },
        }),
      ),
    ).toBeUndefined();
  });

  it("a ?brand= paraméter csak development módban él, és ott is fail-closed ismeretlen brandre", () => {
    vi.stubEnv("NODE_ENV", "development");
    expect(
      resolveRequestBrand(
        new NextRequest("http://localhost:3000/api/cart?brand=gamer", {
          headers: { host: "localhost:3000" },
        }),
      )?.id,
    ).toBe("gamer");
    expect(
      resolveRequestBrand(
        new NextRequest("http://gamer.localhost:3000/api/cart?brand=nemletezik", {
          headers: { host: "gamer.localhost:3000" },
        }),
      ),
    ).toBeUndefined();

    vi.stubEnv("NODE_ENV", "production");
    expect(
      resolveRequestBrand(
        new NextRequest("http://localhost:3000/api/cart?brand=gamer", {
          headers: { host: "localhost:3000" },
        }),
      ),
    ).toBeUndefined();
  });
});
