import { unstable_doesMiddlewareMatch } from "next/experimental/testing/server";
import { NextRequest } from "next/server";
import { afterEach, describe, expect, it, vi } from "vitest";

import { config, proxy } from "../proxy";

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

  it("a matcher csak az /api/ alatti és a statikus útvonalakat hagyja ki", () => {
    const matches = (url: string) => unstable_doesMiddlewareMatch({ config, url });

    expect(matches("/")).toBe(true);
    expect(matches("/termekek")).toBe(true);
    expect(matches("/apiary")).toBe(true);
    expect(matches("/kategoria/api-kiegeszitok")).toBe(true);
    expect(matches("/robots.txt")).toBe(true);
    expect(matches("/robots.txt.bak")).toBe(true);
    expect(matches("/sitemap.xml")).toBe(true);
    expect(matches("/sitemap/1.xml")).toBe(true);

    expect(matches("/api/webhooks/woo/gamer")).toBe(false);
    expect(matches("/_next/static/chunks/main.js")).toBe(false);
    expect(matches("/_next/image")).toBe(false);
    expect(matches("/favicon.ico")).toBe(false);
  });

  it("átírja a /robots.txt és /sitemap.xml kéréseket a brand útvonalára", () => {
    for (const pathname of ["/robots.txt", "/sitemap.xml", "/sitemap/1.xml"]) {
      const req = new NextRequest(`http://gamer.localhost:3000${pathname}`, {
        headers: { host: "gamer.localhost:3000" },
      });
      const res = proxy(req);
      expect(res.status).toBe(200);
      expect(res.headers.get("x-middleware-rewrite")).toBe(
        `http://gamer.localhost:3000/gamer${pathname}`,
      );
    }
  });

  it("nem éles környezetben X-Robots-Tag: noindex, nofollow fejlécet ad, élesben nem", () => {
    vi.stubEnv("NEXT_PUBLIC_APP_ENV", "demo");
    const demoRes = proxy(
      new NextRequest("http://gamer.localhost:3000/", {
        headers: { host: "gamer.localhost:3000" },
      }),
    );
    expect(demoRes.headers.get("x-robots-tag")).toBe("noindex, nofollow");

    vi.stubEnv("NEXT_PUBLIC_APP_ENV", "production");
    const prodRes = proxy(
      new NextRequest("http://gamer.localhost:3000/", {
        headers: { host: "gamer.localhost:3000" },
      }),
    );
    expect(prodRes.headers.get("x-robots-tag")).toBeNull();
  });
});
