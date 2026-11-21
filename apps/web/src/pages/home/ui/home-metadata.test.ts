import { WooError } from "@kg/woo-client";
import { PHASE_PRODUCTION_BUILD } from "next/constants";
import { afterEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ getProducts: vi.fn(), getCategories: vi.fn() }));

vi.mock("@/entities/product/index.server", () => ({ getProducts: mocks.getProducts }));
vi.mock("@/entities/category/index.server", () => ({ getCategories: mocks.getCategories }));

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
    mocks.getProducts.mockResolvedValue([{ id: 1 }]);
    mocks.getCategories.mockResolvedValue([]);
    expect(await generateHomeMetadata(props)).toEqual({});
  });
});
