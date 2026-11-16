import { brands } from "@kg/brand-config";
import { fixtureProducts } from "@kg/woo-client/fixtures";

import { mapProduct } from "./map-product";

const brand = brands[0]!;

describe("mapProduct", () => {
  it("az árakat a Woo minor unitjaiban, számolás nélkül veszi át", () => {
    const raw = fixtureProducts.find((p) => p.on_sale && p.type === "simple")!;
    const product = mapProduct(raw, brand);
    expect(product.price.current.amount).toBe(raw.prices.price);
    expect(product.price.regular.amount).toBe(raw.prices.regular_price);
    expect(product.price.onSale).toBe(true);
    expect(product.price.lowest30Days?.amount).toBe(
      String(raw.extensions.kg_headless?.lowest_price_30_days),
    );
  });

  it("nem akciós terméknél nincs Omnibus-ár", () => {
    const raw = fixtureProducts.find((p) => !p.on_sale)!;
    expect(mapProduct(raw, brand).price.lowest30Days).toBeNull();
  });

  it("kép nélküli terméknél az image null, a leírás sima szöveg, és out_of_stock a készlet", () => {
    const rawNoImage = fixtureProducts.find((p) => p.images.length === 0)!;
    const product = mapProduct(rawNoImage, brand);
    expect(product.image).toBeNull();
    expect(product.stockStatus).toBe("out_of_stock");
    expect(product.summary.join(" ")).not.toMatch(/<\/?[a-z][^>]*>/i);
  });

  it("helyesen képezi le az előrendelhető, alacsony készletes és változatos termékeket", () => {
    const rawBackorder = fixtureProducts.find((p) => p.is_on_backorder)!;
    const backorder = mapProduct(rawBackorder, brand);
    expect(backorder.stockStatus).toBe("backorder");
    expect(backorder.deliveryTime).toContain("Előrendelhető");

    const rawLowStock = fixtureProducts.find(
      (p) => p.is_in_stock && !p.is_on_backorder && p.low_stock_remaining != null,
    )!;
    expect(mapProduct(rawLowStock, brand).stockStatus).toBe("low_stock");

    const rawVariable = fixtureProducts.find((p) => p.type === "variable")!;
    const variable = mapProduct(rawVariable, brand);
    expect(variable.variations.length).toBeGreaterThan(0);
    expect(variable.attributes.some((a) => a.hasVariations)).toBe(true);
    const saleVariation = variable.variations.find((v) => v.price.onSale)!;
    expect(saleVariation.price.lowest30Days?.amount).toBe(
      String(
        rawVariable.extensions.kg_headless?.variations?.find((v) => v.on_sale)
          ?.lowest_price_30_days,
      ),
    );
  });
});
