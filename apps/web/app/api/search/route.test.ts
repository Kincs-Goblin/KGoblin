import { NextRequest } from "next/server";
import { afterEach, describe, expect, it, vi } from "vitest";

import { GET } from "./route";

describe("GET /api/search (KG-50)", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("ismeretlen hostra 404 BRAND.UNKNOWN_HOST választ ad (fail-closed)", async () => {
    const req = new NextRequest("http://unknown.example.com/api/search?q=billentyuzet", {
      headers: { host: "unknown.example.com" },
    });
    const res = await GET(req);
    expect(res.status).toBe(404);
    expect(res.headers.get("cache-control")).toBe("no-store");
    expect(await res.json()).toMatchObject({ ok: false, code: "BRAND.UNKNOWN_HOST" });
  });

  it("a ?brand= paramétert production módban elutasítja", async () => {
    vi.stubEnv("NODE_ENV", "production");
    const req = new NextRequest("http://localhost:3000/api/search?brand=gamer&q=billentyuzet", {
      headers: { host: "localhost:3000" },
    });
    const res = await GET(req);
    expect(res.status).toBe(404);
    expect(await res.json()).toMatchObject({ ok: false, code: "BRAND.UNKNOWN_HOST" });
  });
});
