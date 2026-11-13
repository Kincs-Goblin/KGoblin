import { NextRequest } from "next/server";
import { describe, expect, it } from "vitest";

import { isNoIndexEnvironment, proxy } from "../proxy";

describe("isNoIndexEnvironment", () => {
  it("preview és demo környezetben true-t ad, local és production esetén false-t", () => {
    expect(isNoIndexEnvironment({ NODE_ENV: "test", NEXT_PUBLIC_APP_ENV: "preview" })).toBe(true);
    expect(isNoIndexEnvironment({ NODE_ENV: "test", NEXT_PUBLIC_APP_ENV: "demo" })).toBe(true);
    expect(isNoIndexEnvironment({ NODE_ENV: "test", VERCEL_ENV: "preview" })).toBe(true);
    expect(isNoIndexEnvironment({ NODE_ENV: "test", NEXT_PUBLIC_APP_ENV: "local" })).toBe(false);
    expect(
      isNoIndexEnvironment({
        NODE_ENV: "test",
        NEXT_PUBLIC_APP_ENV: "production",
        VERCEL_ENV: "production",
      }),
    ).toBe(false);
  });
});

describe("proxy", () => {
  it("ismeretlen hostra 404 BRAND.UNKNOWN_HOST választ ad", async () => {
    const req = new NextRequest("http://unknown.example.com/", {
      headers: { host: "unknown.example.com" },
    });
    const res = proxy(req);
    expect(res.status).toBe(404);
    expect(await res.text()).toBe("BRAND.UNKNOWN_HOST");
  });

  it("gamer.localhost esetén átírja a kérést, és preview módban beállítja az X-Robots-Tag fejlécet", () => {
    const prevEnv = process.env.NEXT_PUBLIC_APP_ENV;
    try {
      process.env.NEXT_PUBLIC_APP_ENV = "preview";
      const req = new NextRequest("http://gamer.localhost:3000/katalogus", {
        headers: { host: "gamer.localhost:3000" },
      });
      const res = proxy(req);
      expect(res.status).toBe(200);
      expect(res.headers.get("X-Robots-Tag")).toBe("noindex, nofollow");
    } finally {
      if (prevEnv === undefined) {
        delete process.env.NEXT_PUBLIC_APP_ENV;
      } else {
        process.env.NEXT_PUBLIC_APP_ENV = prevEnv;
      }
    }
  });
});
