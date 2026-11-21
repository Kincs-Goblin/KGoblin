import { WooError } from "@kg/woo-client";
import { describe, expect, it, vi } from "vitest";

const { getProductMock } = vi.hoisted(() => ({ getProductMock: vi.fn() }));

vi.mock("@/entities/product/index.server", () => ({ getProduct: getProductMock }));

import { generateProductMetadata } from "./product-page";

describe("generateProductMetadata", () => {
  it("Woo-kiesésnél a hibaállapotú oldal noindex", async () => {
    getProductMock.mockRejectedValue(new WooError("WOO.UNAVAILABLE", "down"));
    const params = Promise.resolve({ brand: "gamer", slug: "x" });
    expect(await generateProductMetadata({ params })).toEqual({ robots: { index: false } });
  });
});
