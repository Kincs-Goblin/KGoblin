import { render, screen } from "@testing-library/react";
import { StrictMode } from "react";

import { CartProvider, useCart } from "./cart-context";

const stored = {
  lines: [
    {
      productId: 1,
      slug: "apexstrike",
      name: "ApexStrike",
      unitPrice: { amount: "27990", currency: "HUF", minorUnit: 0 },
      quantity: 2,
    },
  ],
};

function Count() {
  return <span data-testid="count">{useCart().itemCount}</span>;
}

describe("CartProvider", () => {
  beforeEach(() => localStorage.clear());

  it("StrictMode dupla effect-futása mellett sem üríti ki a tárolt kosarat", async () => {
    localStorage.setItem("kg-cart:gamer", JSON.stringify(stored));
    render(
      <StrictMode>
        <CartProvider brandId="gamer">
          <Count />
        </CartProvider>
      </StrictMode>,
    );

    expect(await screen.findByText("2")).toBeInTheDocument();
    expect(JSON.parse(localStorage.getItem("kg-cart:gamer") ?? "null")).toEqual(stored);
  });

  it("a brandek kosara külön kulcson van", async () => {
    localStorage.setItem("kg-cart:gamer", JSON.stringify(stored));
    render(
      <CartProvider brandId="masik">
        <Count />
      </CartProvider>,
    );

    expect(await screen.findByTestId("count")).toHaveTextContent("0");
    expect(localStorage.getItem("kg-cart:gamer")).toBe(JSON.stringify(stored));
  });
});
