import { render, screen } from "@testing-library/react";

import { productTexts } from "../config/texts";
import { ProductPrice } from "./product-price";

describe("ProductPrice", () => {
  it("akciós terméknél megjeleníti az akciós árat, az áthúzott eredeti árat és az Omnibus 30 napos minimumot", () => {
    render(
      <ProductPrice
        price={{
          current: { amount: "36990", currency: "HUF", minorUnit: 0 },
          regular: { amount: "44990", currency: "HUF", minorUnit: 0 },
          onSale: true,
          lowest30Days: { amount: "34990", currency: "HUF", minorUnit: 0 },
        }}
      />,
    );

    expect(screen.getByText(/36\s*990\s*Ft/)).toBeInTheDocument();
    expect(screen.getByText(/44\s*990\s*Ft/)).toBeInTheDocument();
    expect(screen.getByText(new RegExp(productTexts.lowest30Days))).toBeInTheDocument();
    expect(screen.getByText(/34\s*990\s*Ft/)).toBeInTheDocument();
  });

  it("akciós terméknél hiányzó Omnibus-ár esetén nem jelenít meg 30 napos sort", () => {
    render(
      <ProductPrice
        price={{
          current: { amount: "27990", currency: "HUF", minorUnit: 0 },
          regular: { amount: "32990", currency: "HUF", minorUnit: 0 },
          onSale: true,
          lowest30Days: null,
        }}
      />,
    );

    expect(screen.getByText(/27\s*990\s*Ft/)).toBeInTheDocument();
    expect(screen.queryByText(new RegExp(productTexts.lowest30Days))).not.toBeInTheDocument();
  });

  it("nem akciós terméknél csak a normál árat jeleníti meg, minor unit (EUR 2 tizedes) figyelembevételével", () => {
    render(
      <ProductPrice
        price={{
          current: { amount: "1999", currency: "EUR", minorUnit: 2 },
          regular: { amount: "1999", currency: "EUR", minorUnit: 2 },
          onSale: false,
          lowest30Days: null,
        }}
      />,
    );

    expect(screen.getByText(/19,99/)).toBeInTheDocument();
    expect(screen.queryByText(productTexts.regularPrice, { exact: false })).not.toBeInTheDocument();
    expect(screen.queryByText(new RegExp(productTexts.lowest30Days))).not.toBeInTheDocument();
  });
});
