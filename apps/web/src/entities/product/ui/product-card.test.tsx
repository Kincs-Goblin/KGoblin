import { brands } from "@kg/brand-config";
import { fixtureProducts } from "@kg/woo-client/fixtures";
import { render, screen } from "@testing-library/react";

import { productTexts } from "../config/texts";
import { mapProduct } from "../lib/map-product";
import { ProductCard } from "./product-card";

const brand = brands[0]!;

describe("ProductCard", () => {
  it("megjeleníti a termék nevét, linkjét, árát, készletét és az opcionális műveleti slotot", () => {
    const raw = fixtureProducts.find((p) => p.on_sale && p.type === "simple")!;
    const product = mapProduct(raw, brand);

    render(<ProductCard product={product} action={<button type="button">Kosárba</button>} />);

    const link = screen.getByRole("link", { name: new RegExp(product.name) });
    expect(link).toHaveAttribute("href", `/termek/${product.slug}`);
    expect(screen.getByRole("button", { name: "Kosárba" })).toBeInTheDocument();
  });

  it("kép nélküli és elfogyott terméknél placeholder képet és elfogyott jelzést mutat", () => {
    const rawOos = fixtureProducts.find((p) => p.images.length === 0 && !p.is_in_stock)!;
    const product = mapProduct(rawOos, brand);

    render(<ProductCard product={product} />);

    expect(screen.getByRole("img", { name: productTexts.noImage })).toBeInTheDocument();
    expect(screen.getByText(productTexts.outOfStock)).toBeInTheDocument();
  });
});
