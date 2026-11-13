import { NextRequest } from "next/server";
import { describe, expect, it } from "vitest";

import { proxy } from "../proxy";

describe("proxy", () => {
  it("ismeretlen hostra 404 BRAND.UNKNOWN_HOST választ ad", async () => {
    const req = new NextRequest("http://unknown.example.com/", {
      headers: { host: "unknown.example.com" },
    });
    const res = proxy(req);
    expect(res.status).toBe(404);
    expect(await res.text()).toBe("BRAND.UNKNOWN_HOST");
  });

  it("gamer.localhost esetén átírja a kérést a /gamer útvonalra", () => {
    const req = new NextRequest("http://gamer.localhost:3000/termekek", {
      headers: { host: "gamer.localhost:3000" },
    });
    const res = proxy(req);
    expect(res.status).toBe(200);
    expect(res.headers.get("x-middleware-rewrite")).toBe(
      "http://gamer.localhost:3000/gamer/termekek",
    );
  });
});
