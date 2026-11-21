import { describe, expect, it } from "vitest";

import { parseServerEnv } from "./env";
import { parseClientEnv } from "./env.client";

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

  it("production környezetben fixture-katalógussal nem indul el", () => {
    expect(() =>
      parseServerEnv({
        NODE_ENV: "production",
        KG_STORE_FIXTURES: "1",
        NEXT_PUBLIC_APP_ENV: "production",
      }),
    ).toThrow(/KG_STORE_FIXTURES: production/);
  });

  it("demo és local környezetben a fixture-mód megengedett", () => {
    for (const appEnv of ["local", "demo"]) {
      const env = parseServerEnv({
        NODE_ENV: "production",
        KG_STORE_FIXTURES: "1",
        NEXT_PUBLIC_APP_ENV: appEnv,
      });
      expect(env.KG_STORE_FIXTURES).toBe("1");
    }
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
