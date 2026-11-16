import { formatMoney, getCurrencyLabel, getCurrencyMinorUnit } from "./money";

const nbsp = (value: string) => value.replace(/\s/g, " ");

describe("formatMoney", () => {
  it("HUF-ot tizedes nélkül, magyar ezres tagolással ír", () => {
    expect(nbsp(formatMoney({ amount: "16990", currency: "HUF", minorUnit: 0 }))).toBe("16 990 Ft");
  });

  it("minor unitból tizedest képez lebegőpontos szorzás nélkül", () => {
    // A pénznemjel ICU-függő (€ vagy EUR); a tizedes képzését nézzük.
    expect(nbsp(formatMoney({ amount: "1999", currency: "EUR", minorUnit: 2 }))).toMatch(
      /^19,99 (€|EUR)$/,
    );
    expect(nbsp(formatMoney({ amount: "5", currency: "EUR", minorUnit: 2 }))).toMatch(
      /^0,05 (€|EUR)$/,
    );
  });

  it("helyes minorUnit és lokalizált pénznemcímke segédfüggvényeket ad", () => {
    expect(getCurrencyMinorUnit("HUF")).toBe(0);
    expect(getCurrencyMinorUnit("EUR")).toBe(2);
    expect(getCurrencyMinorUnit("KWD")).toBe(3);
    expect(getCurrencyLabel("HUF", "hu-HU")).toBe("Ft");
    expect(getCurrencyLabel("EUR", "hu-HU")).toMatch(/€|EUR/);
    expect(getCurrencyLabel("INVALID", "hu-HU")).toBe("INVALID");
  });
});
