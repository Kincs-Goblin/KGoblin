import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import { CartProvider } from "@/entities/cart";
import type { Product } from "@/entities/product";

import { ProductDetails } from "./product-details";

const variableProduct: Product = {
  id: 63,
  slug: "runakard-tkl-pro",
  type: "variable",
  name: "RunaKard TKL Pro Vezeték Nélküli Billentyűzet",
  sku: "KG-GMR-VAR-009",
  summary: ["Testreszabható prémium TKL billentyűzet."],
  description: ["Részletes leírás."],
  image: { src: "http://localhost:8080/black.png", alt: "Fekete" },
  images: [
    { src: "http://localhost:8080/black.png", alt: "Fekete" },
    { src: "http://localhost:8080/gold.png", alt: "Arany" },
    { src: "http://localhost:8080/white.png", alt: "Fehér" },
  ],
  categories: [{ id: 31, name: "Gyűjtői Kiadások", slug: "gyujtoi-kiadasok" }],
  attributes: [
    {
      id: 1,
      name: "Kapcsoló",
      taxonomy: "pa_kapcsolo",
      hasVariations: true,
      terms: [
        { id: 19, name: "Lineáris Red", slug: "linearis-red" },
        { id: 20, name: "Taktilis Brown", slug: "taktilis-brown" },
      ],
    },
    {
      id: 2,
      name: "Szín",
      taxonomy: "pa_szin",
      hasVariations: true,
      terms: [
        { id: 22, name: "Goblin Arany", slug: "goblin-arany" },
        { id: 23, name: "Holdfény Fehér", slug: "holdfeny-feher" },
        { id: 21, name: "Obszidián Fekete", slug: "obszidian-fekete" },
      ],
    },
    {
      id: 3,
      name: "Platform",
      taxonomy: "pa_platform",
      hasVariations: false,
      terms: [{ id: 24, name: "PC / Mac", slug: "pc-mac" }],
    },
  ],
  variations: [
    {
      id: 64,
      sku: "KG-GMR-VAR-009-RED-BLK",
      attributes: [
        { name: "Kapcsoló", taxonomy: "pa_kapcsolo", value: "Lineáris Red", slug: "linearis-red" },
        { name: "Szín", taxonomy: "pa_szin", value: "Obszidián Fekete", slug: "obszidian-fekete" },
      ],
      price: {
        current: { amount: "42990", currency: "HUF", minorUnit: 0 },
        regular: { amount: "42990", currency: "HUF", minorUnit: 0 },
        onSale: false,
        lowest30Days: null,
      },
      stockStatus: "in_stock",
      inStock: true,
      onBackorder: false,
      purchasable: true,
      lowStockRemaining: null,
      deliveryTime: "1–2 munkanap",
      image: { src: "http://localhost:8080/black.png", alt: "Fekete" },
    },
    {
      id: 65,
      sku: "KG-GMR-VAR-009-BRN-GLD",
      attributes: [
        {
          name: "Kapcsoló",
          taxonomy: "pa_kapcsolo",
          value: "Taktilis Brown",
          slug: "taktilis-brown",
        },
        { name: "Szín", taxonomy: "pa_szin", value: "Goblin Arany", slug: "goblin-arany" },
      ],
      price: {
        current: { amount: "39990", currency: "HUF", minorUnit: 0 },
        regular: { amount: "46990", currency: "HUF", minorUnit: 0 },
        onSale: true,
        lowest30Days: { amount: "41990", currency: "HUF", minorUnit: 0 },
      },
      stockStatus: "low_stock",
      inStock: true,
      onBackorder: false,
      purchasable: true,
      lowStockRemaining: 2,
      deliveryTime: "1–3 munkanap",
      image: { src: "http://localhost:8080/gold.png", alt: "Arany" },
    },
    {
      id: 66,
      sku: "KG-GMR-VAR-009-RED-WHT",
      attributes: [
        { name: "Kapcsoló", taxonomy: "pa_kapcsolo", value: "Lineáris Red", slug: "linearis-red" },
        { name: "Szín", taxonomy: "pa_szin", value: "Holdfény Fehér", slug: "holdfeny-feher" },
      ],
      price: {
        current: { amount: "44990", currency: "HUF", minorUnit: 0 },
        regular: { amount: "44990", currency: "HUF", minorUnit: 0 },
        onSale: false,
        lowest30Days: null,
      },
      stockStatus: "out_of_stock",
      inStock: false,
      onBackorder: false,
      purchasable: true,
      lowStockRemaining: null,
      deliveryTime: null,
      image: { src: "http://localhost:8080/white.png", alt: "Fehér" },
    },
  ],
  price: {
    current: { amount: "39990", currency: "HUF", minorUnit: 0 },
    regular: { amount: "42990", currency: "HUF", minorUnit: 0 },
    onSale: true,
    lowest30Days: null,
  },
  stockStatus: "in_stock",
  inStock: true,
  onBackorder: false,
  purchasable: true,
  lowStockRemaining: null,
  deliveryTime: "1–3 munkanap",
  rarity: "epic",
};

describe("ProductDetails", () => {
  it("variáns választáskor frissíti az árat, a készletet, a SKU-t és letiltja a nem létező kombinációt", async () => {
    const user = userEvent.setup();

    render(
      <CartProvider brandId="gamer">
        <ProductDetails product={variableProduct} />
      </CartProvider>,
    );

    // Kezdetben az első készleten lévő variáció (Lineáris Red + Obszidián Fekete) aktív.
    expect(screen.getByText(/KG-GMR-VAR-009-RED-BLK/)).toBeInTheDocument();
    expect(screen.getByText(/1–2 munkanap/)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Goblin Arany" })).toBeDisabled();

    // Váltás Taktilis Brown kapcsolóra -> automatikusan Goblin Arany színre ugrik (akciós, kevés készlet).
    await user.click(screen.getByRole("button", { name: "Taktilis Brown" }));
    expect(screen.getByText(/KG-GMR-VAR-009-BRN-GLD/)).toBeInTheDocument();
    expect(screen.getByText("Már csak 2 db")).toBeInTheDocument();
    expect(screen.getByText(/Az elmúlt 30 nap legalacsonyabb ára:/)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Obszidián Fekete" })).toBeDisabled();

    // Visszaváltás Lineáris Red -> Holdfény Fehér elfogyott variáció -> kosárba gomb letiltva.
    await user.click(screen.getByRole("button", { name: "Lineáris Red" }));
    await user.click(screen.getByRole("button", { name: "Holdfény Fehér" }));
    expect(screen.getByText(/KG-GMR-VAR-009-RED-WHT/)).toBeInTheDocument();
    expect(screen.getByText("Elfogyott")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Nem elérhető" })).toBeDisabled();

    // Nem-variációs attribútum megjelenik a jellemzők között.
    expect(screen.getByText("Platform")).toBeInTheDocument();
    expect(screen.getByText("PC / Mac")).toBeInTheDocument();
  });

  it("lokális attribútummal (üres taxonomy) és Any (üres slug) variációval is működik", async () => {
    const user = userEvent.setup();
    const localAnyProduct: Product = {
      ...variableProduct,
      id: 70,
      slug: "any-anyag-test",
      name: "Any és Lokális Teszt Termék",
      attributes: [
        {
          id: 0,
          name: "Anyag típus",
          taxonomy: "",
          hasVariations: true,
          terms: [
            { id: 0, name: "Acél", slug: "Acél" },
            { id: 0, name: "Titán", slug: "Titán" },
          ],
        },
        {
          id: 2,
          name: "Szín",
          taxonomy: "pa_szin",
          hasVariations: true,
          terms: [
            { id: 21, name: "Obszidián Fekete", slug: "obszidian-fekete" },
            { id: 22, name: "Goblin Arany", slug: "goblin-arany" },
          ],
        },
      ],
      variations: [
        {
          id: 71,
          sku: "KG-ANY-ACEL",
          attributes: [
            { name: "Anyag típus", taxonomy: "anyag-tipus", value: "Acél", slug: "Acél" },
            { name: "Szín", taxonomy: "pa_szin", value: "", slug: "" },
          ],
          price: {
            current: { amount: "10000", currency: "HUF", minorUnit: 0 },
            regular: { amount: "10000", currency: "HUF", minorUnit: 0 },
            onSale: false,
            lowest30Days: null,
          },
          stockStatus: "in_stock",
          inStock: true,
          onBackorder: false,
          purchasable: true,
          lowStockRemaining: null,
          deliveryTime: "1–3 munkanap",
          image: null,
        },
        {
          id: 72,
          sku: "KG-TITAN-GLD",
          attributes: [
            { name: "Anyag típus", taxonomy: "anyag-tipus", value: "Titán", slug: "Titán" },
            { name: "Szín", taxonomy: "pa_szin", value: "Goblin Arany", slug: "goblin-arany" },
          ],
          price: {
            current: { amount: "15990", currency: "HUF", minorUnit: 0 },
            regular: { amount: "15990", currency: "HUF", minorUnit: 0 },
            onSale: false,
            lowest30Days: null,
          },
          stockStatus: "in_stock",
          inStock: true,
          onBackorder: false,
          purchasable: true,
          lowStockRemaining: null,
          deliveryTime: "1–3 munkanap",
          image: null,
        },
      ],
    };

    render(
      <CartProvider brandId="gamer">
        <ProductDetails product={localAnyProduct} />
      </CartProvider>,
    );

    // Kezdetben Acél + Obszidián Fekete aktív (mert az Anyag=Acél variációnál a Szín Any/""), mindkét szín választható.
    expect(screen.getByText(/KG-ANY-ACEL/)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Obszidián Fekete" })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
    expect(screen.getByRole("button", { name: "Goblin Arany" })).toBeEnabled();

    // Anyag=Acél mellett Goblin Arany is választható marad.
    await user.click(screen.getByRole("button", { name: "Goblin Arany" }));
    expect(screen.getByRole("button", { name: "Goblin Arany" })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
    expect(screen.getByText(/KG-ANY-ACEL/)).toBeInTheDocument();

    // Titánra váltva a konkrét Goblin Arany variáció lesz aktív, Obszidián Fekete pedig tiltott.
    await user.click(screen.getByRole("button", { name: "Titán" }));
    expect(screen.getByText(/KG-TITAN-GLD/)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Obszidián Fekete" })).toBeDisabled();
  });
});
