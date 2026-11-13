import { brands } from "@kg/brand-config";
import { fixtureProducts } from "@kg/woo-client/fixtures";

import { mapProduct } from "./map-product";

const brand = brands[0]!;

describe("mapProduct", () => {
  it("az árakat a Woo minor unitjaiban, számolás nélkül veszi át", () => {
    const raw = fixtureProducts.find((p) => p.on_sale)!;
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

  it("kép nélküli terméknél az image null, a leírás sima szöveg", () => {
    const product = mapProduct(fixtureProducts[0]!, brand);
    expect(product.image).toBeNull();
    expect(product.summary.join(" ")).not.toMatch(/<\/?[a-z][^>]*>/i);
  });
});
