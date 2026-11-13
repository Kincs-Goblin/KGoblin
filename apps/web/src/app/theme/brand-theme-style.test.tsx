import { brands } from "@kg/brand-config";
import { render } from "@testing-library/react";

import { BrandThemeStyle } from "./brand-theme-style";

vi.mock("./fonts", () => ({
  fontVariableByKey: {
    cinzel: "--font-cinzel",
    "alegreya-sans": "--font-alegreya-sans",
    inter: "--font-inter",
  },
}));

describe("BrandThemeStyle", () => {
  it("a brand tokenjeit és fontjait a :root CSS-változóiként adja ki", () => {
    const brand = brands[0]!;
    const { container } = render(<BrandThemeStyle brand={brand} />);
    const css = container.querySelector("style")?.textContent ?? "";

    expect(css.startsWith(":root{")).toBe(true);
    expect(css).toContain(`--background:${brand.theme.colors.background};`);
    expect(css).toContain(`--rarity-legendary:${brand.theme.colors["rarity-legendary"]};`);
    expect(css).toContain("--font-heading:var(--font-cinzel)");
  });
});
