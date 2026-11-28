import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { StrictMode } from "react";
import { toast } from "sonner";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { CartProvider, useCart } from "./cart-context";
import { EMPTY_CART_DTO, type CartDto } from "./types";

vi.mock("sonner", () => ({
  toast: {
    error: vi.fn(),
    success: vi.fn(),
  },
}));

const sampleCart: CartDto = {
  ...EMPTY_CART_DTO,
  items: [
    {
      key: "item-1",
      productId: 24,
      quantity: 1,
      name: "LumiBar Pro",
      slug: "lumibar-pro",
      sku: "KG-GMR-LT-008",
      image: null,
      variation: [],
      unitPrice: { amount: "16990", currency: "HUF", minorUnit: 0 },
      regularPrice: { amount: "21990", currency: "HUF", minorUnit: 0 },
      lineSubtotal: { amount: "16990", currency: "HUF", minorUnit: 0 },
      lineTotal: { amount: "16990", currency: "HUF", minorUnit: 0 },
    },
  ],
  itemsCount: 1,
  totals: {
    ...EMPTY_CART_DTO.totals,
    items: { amount: "16990", currency: "HUF", minorUnit: 0 },
    total: { amount: "16990", currency: "HUF", minorUnit: 0 },
  },
};

function Harness() {
  const { cart, itemCount, updateItemQuantity } = useCart();
  return (
    <div>
      <span data-testid="count">{itemCount}</span>
      <span data-testid="qty">{cart.items[0]?.quantity ?? 0}</span>
      <button type="button" onClick={() => void updateItemQuantity("item-1", 3)}>
        növel
      </button>
    </div>
  );
}

describe("CartProvider (BFF)", () => {
  const originalFetch = globalThis.fetch;

  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
  });

  it("betölti a kosarat a GET /api/cart végpontról StrictMode mellett is", async () => {
    globalThis.fetch = vi.fn(
      async () =>
        new Response(JSON.stringify({ ok: true, cart: sampleCart }), {
          status: 200,
          headers: { "content-type": "application/json" },
        }),
    ) as typeof fetch;

    render(
      <StrictMode>
        <CartProvider brandId="gamer">
          <Harness />
        </CartProvider>
      </StrictMode>,
    );

    expect(await screen.findByTestId("count")).toHaveTextContent("1");
    expect(screen.getByTestId("qty")).toHaveTextContent("1");
  });

  it("optimistán frissíti a mennyiséget, majd hiba esetén visszaállítja és toastot mutat", async () => {
    const user = userEvent.setup();
    let resolvePatch!: (res: Response) => void;

    globalThis.fetch = vi.fn(async (_url, init) => {
      if (init?.method === "PATCH") {
        return new Promise<Response>((resolve) => {
          resolvePatch = resolve;
        });
      }
      return new Response(JSON.stringify({ ok: true, cart: sampleCart }), {
        status: 200,
        headers: { "content-type": "application/json" },
      });
    }) as typeof fetch;

    render(
      <CartProvider brandId="gamer">
        <Harness />
      </CartProvider>,
    );

    expect(await screen.findByTestId("qty")).toHaveTextContent("1");

    await user.click(screen.getByRole("button", { name: "növel" }));
    // Optimista frissítés azonnal látszik
    expect(screen.getByTestId("qty")).toHaveTextContent("3");
    expect(screen.getByTestId("count")).toHaveTextContent("3");

    // Szerver 409 készlethiánnyal visszautasítja -> visszaáll 1-re + toast.error
    resolvePatch(
      new Response(
        JSON.stringify({
          ok: false,
          code: "CART.OUT_OF_STOCK",
          message: "A választott zsákmány időközben elfogyott.",
        }),
        { status: 409, headers: { "content-type": "application/json" } },
      ),
    );

    await waitFor(() => {
      expect(screen.getByTestId("qty")).toHaveTextContent("1");
    });
    expect(screen.getByTestId("count")).toHaveTextContent("1");
    expect(toast.error).toHaveBeenCalledWith("A választott zsákmány időközben elfogyott.");
  });

  async function renderAndFailPatch(errorBody: Record<string, unknown>, status: number) {
    const user = userEvent.setup();
    globalThis.fetch = vi.fn(async (_url, init) => {
      if (init?.method === "PATCH") {
        return new Response(JSON.stringify(errorBody), {
          status,
          headers: { "content-type": "application/json" },
        });
      }
      return new Response(JSON.stringify({ ok: true, cart: sampleCart }), {
        status: 200,
        headers: { "content-type": "application/json" },
      });
    }) as typeof fetch;

    render(
      <CartProvider brandId="gamer">
        <Harness />
      </CartProvider>,
    );
    expect(await screen.findByTestId("qty")).toHaveTextContent("1");
    await user.click(screen.getByRole("button", { name: "növel" }));
  }

  it("upstream hibánál a válaszban kapott üres kosár nem írja felül a kliens kosarát", async () => {
    await renderAndFailPatch(
      {
        ok: false,
        code: "WOO.UNAVAILABLE",
        message: "A kincstár most nem elérhető. Próbáld újra pár perc múlva.",
        cart: EMPTY_CART_DTO,
      },
      503,
    );

    await waitFor(() => {
      expect(toast.error).toHaveBeenCalled();
    });
    expect(screen.getByTestId("count")).toHaveTextContent("1");
    expect(screen.getByTestId("qty")).toHaveTextContent("1");
  });

  it("valódi CART.SESSION_INVALID esetén átveszi a szerver által indított új kosarat", async () => {
    await renderAndFailPatch(
      {
        ok: false,
        code: "CART.SESSION_INVALID",
        message: "A kosár munkamenete lejárt, új kosarat indítottunk.",
        cart: EMPTY_CART_DTO,
      },
      401,
    );

    await waitFor(() => {
      expect(screen.getByTestId("count")).toHaveTextContent("0");
    });
  });
});
