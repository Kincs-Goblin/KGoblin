import { WooError } from "@kg/woo-client";
import { PHASE_PRODUCTION_BUILD } from "next/constants";
import { afterEach, describe, expect, it, vi } from "vitest";

import type * as SharedConfig from "@/shared/config";

const mocks = vi.hoisted(() => ({ getProducts: vi.fn(), getCategories: vi.fn() }));

vi.mock("@/entities/product/index.server", () => ({ getProducts: mocks.getProducts }));
vi.mock("@/entities/category/index.server", () => ({ getCategories: mocks.getCategories }));
vi.mock("@/shared/config", async (importOriginal) => {
  const actual = await importOriginal<typeof SharedConfig>();
  return {
    ...actual,
    clientEnv: { ...actual.clientEnv, NEXT_PUBLIC_APP_ENV: "production" },
  };
});

import { generateHomeMetadata } from "./home-page";

const props = { params: Promise.resolve({ brand: "gamer" }) };

describe("generateHomeMetadata", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("buildkori Woo-hibánál a hibaállapot noindex", async () => {
    vi.stubEnv("NEXT_PHASE", PHASE_PRODUCTION_BUILD);
    mocks.getProducts.mockRejectedValue(new WooError("WOO.UNAVAILABLE", "down"));
    mocks.getCategories.mockResolvedValue([]);
    expect(await generateHomeMetadata(props)).toEqual({ robots: { index: false } });
  });

  it("futáskori Woo-hibánál továbbdob, így az ISR a legutóbbi jó oldalt tartja meg", async () => {
    mocks.getProducts.mockRejectedValue(new WooError("WOO.UNAVAILABLE", "down"));
    mocks.getCategories.mockResolvedValue([]);
    await expect(generateHomeMetadata(props)).rejects.toMatchObject({ code: "WOO.UNAVAILABLE" });
  });

  it("elérhető Woo mellett indexelhető", async () => {
    vi.stubEnv("NEXT_PUBLIC_APP_ENV", "production");
    mocks.getProducts.mockResolvedValue([{ id: 1 }]);
    mocks.getCategories.mockResolvedValue([]);
    expect(await generateHomeMetadata(props)).toMatchObject({
      alternates: { canonical: expect.stringMatching(/\/$/) },
      robots: { index: true, follow: true },
    });
  });
});
