import { NextRequest } from "next/server";
import { afterEach, describe, expect, it, vi } from "vitest";

import { proxy } from "../proxy";

describe("proxy", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("ismeretlen hostra 404 BRAND.UNKNOWN_HOST választ ad", async () => {
    const req = new NextRequest("http://unknown.example.com/", {
      headers: { host: "unknown.example.com" },
    });
    const res = proxy(req);
    expect(res.status).toBe(404);
    expect(await res.text()).toBe("BRAND.UNKNOWN_HOST");
  });

  it("a Workers preview-domainre is 404 BRAND.UNKNOWN_HOST választ ad (fail-closed)", async () => {
    const req = new NextRequest("https://abc123-kincsgoblin.devdemos.workers.dev/", {
      headers: { host: "abc123-kincsgoblin.devdemos.workers.dev" },
    });
    const res = proxy(req);
    expect(res.status).toBe(404);
    expect(await res.text()).toBe("BRAND.UNKNOWN_HOST");
  });

  it("gamer.localhost és www.gamer.localhost esetén is átírja a kérést a /gamer útvonalra", () => {
    for (const host of ["gamer.localhost:3000", "www.gamer.localhost:3000"]) {
      const req = new NextRequest(`http://${host}/termekek`, {
        headers: { host },
      });
      const res = proxy(req);
      expect(res.status).toBe(200);
      expect(res.headers.get("x-middleware-rewrite")).toBe(`http://${host}/gamer/termekek`);
    }
  });

  it("a ?brand= paraméter csak development módban engedélyezett", async () => {
    vi.stubEnv("NODE_ENV", "development");
    const devReq = new NextRequest("http://localhost:3000/termekek?brand=gamer", {
      headers: { host: "localhost:3000" },
    });
    const devRes = proxy(devReq);
    expect(devRes.status).toBe(200);
    expect(devRes.headers.get("x-middleware-rewrite")).toBe(
      "http://localhost:3000/gamer/termekek?brand=gamer",
    );

    const invalidDevReq = new NextRequest("http://localhost:3000/termekek?brand=unknown", {
      headers: { host: "localhost:3000" },
    });
    expect(proxy(invalidDevReq).status).toBe(404);

    vi.stubEnv("NODE_ENV", "production");
    const prodReq = new NextRequest("http://localhost:3000/termekek?brand=gamer", {
      headers: { host: "localhost:3000" },
    });
    const prodRes = proxy(prodReq);
    expect(prodRes.status).toBe(404);
    expect(await prodRes.text()).toBe("BRAND.UNKNOWN_HOST");
  });
});
