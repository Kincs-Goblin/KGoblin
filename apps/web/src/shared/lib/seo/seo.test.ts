import { brands, getBrandCanonicalOrigin } from "@kg/brand-config";
import { describe, expect, it } from "vitest";

import {
  buildBreadcrumbJsonLd,
  buildCanonicalUrl,
  buildOrganizationJsonLd,
  buildPageMetadata,
  buildProductJsonLd,
  buildWebSiteJsonLd,
  escapeXml,
  isIndexableEnv,
  minorUnitToDecimalString,
  oklchToHex,
  renderRobotsTxt,
  renderSitemapIndexXml,
  renderUrlSetXml,
  serializeJsonLd,
} from "./index";
import { resolvePublicOgImageUrl } from "./og-card";

const gamerBrand = brands[0]!;
const gamerOrigin = getBrandCanonicalOrigin(gamerBrand);

describe("SEO segédfüggvények", () => {
  it("isIndexableEnv csak production környezetben igaz", () => {
    expect(isIndexableEnv("production")).toBe(true);
    expect(isIndexableEnv("demo")).toBe(false);
    expect(isIndexableEnv("preview")).toBe(false);
    expect(isIndexableEnv("local")).toBe(false);
    expect(isIndexableEnv(undefined)).toBe(false);
  });

  it("buildCanonicalUrl eldobja a query paramétereket és a fragmentet", () => {
    expect(buildCanonicalUrl(gamerBrand, "/")).toBe(`${gamerOrigin}/`);
    expect(buildCanonicalUrl(gamerBrand, "/termekek?rendezes=ar-novekvo&oldal=2#top")).toBe(
      `${gamerOrigin}/termekek`,
    );
    expect(buildCanonicalUrl(gamerBrand, "/termek/runakard/")).toBe(
      `${gamerOrigin}/termek/runakard`,
    );
  });

  it("buildPageMetadata élesben indexelhető, demóban vagy noIndex esetén noindex", () => {
    const prodMeta = buildPageMetadata({
      brand: gamerBrand,
      title: "Billentyűzetek",
      description: "Mechanikus gamer billentyűzetek.",
      canonicalPath: "/kategoria/billentyuzetek",
      appEnv: "production",
    });
    expect(prodMeta.alternates?.canonical).toBe(`${gamerOrigin}/kategoria/billentyuzetek`);
    expect(prodMeta.robots).toEqual({ index: true, follow: true });
    expect(prodMeta.openGraph?.title).toBe("Billentyűzetek | KincsGoblin");
    expect(prodMeta.openGraph?.url).toBe(`${gamerOrigin}/kategoria/billentyuzetek`);

    const demoMeta = buildPageMetadata({
      brand: gamerBrand,
      title: "Billentyűzetek",
      canonicalPath: "/kategoria/billentyuzetek",
      appEnv: "demo",
    });
    expect(demoMeta.robots).toEqual({ index: false, follow: false });

    const searchMeta = buildPageMetadata({
      brand: gamerBrand,
      title: "Termékek",
      canonicalPath: "/termekek",
      noIndex: true,
      appEnv: "production",
    });
    expect(searchMeta.robots).toEqual({ index: false, follow: false });
  });

  it("minorUnitToDecimalString float-mentesen alakít át minor unit összeget", () => {
    expect(minorUnitToDecimalString("16990", 0)).toBe("16990");
    expect(minorUnitToDecimalString("0016990", 0)).toBe("16990");
    expect(minorUnitToDecimalString("1299", 2)).toBe("12.99");
    expect(minorUnitToDecimalString("5", 2)).toBe("0.05");
    expect(minorUnitToDecimalString("bad", 2)).toBe("0");
  });

  it("serializeJsonLd kiszűri a </script> injekciót", () => {
    const serialized = serializeJsonLd({ name: "</script><script>alert(1)</script>" });
    expect(serialized).not.toContain("</script>");
    expect(serialized).toContain("\\u003c/script>");
  });

  it("Organization, WebSite és BreadcrumbList JSON-LD helyes szerkezetet ad", () => {
    const org = buildOrganizationJsonLd(gamerBrand);
    expect(org["@type"]).toBe("Organization");
    expect(org.url).toBe(`${gamerOrigin}/`);

    const site = buildWebSiteJsonLd(gamerBrand);
    expect(site["@type"]).toBe("WebSite");
    expect(site.potentialAction).toMatchObject({
      "@type": "SearchAction",
      target: {
        urlTemplate: `${gamerOrigin}/kereses?q={search_term_string}`,
      },
    });

    const crumbs = buildBreadcrumbJsonLd(gamerBrand, [
      { name: "Főoldal", path: "/" },
      { name: "Termékek", path: "/termekek" },
    ]);
    expect(crumbs["@type"]).toBe("BreadcrumbList");
    expect(crumbs.itemListElement).toHaveLength(2);
  });

  it("buildProductJsonLd csak érvényes GTIN és valódi értékelés esetén adja meg a mezőket", () => {
    const full = buildProductJsonLd({
      brand: gamerBrand,
      product: {
        name: "Rúnakard TKL Pro",
        slug: "runakard-tkl-pro",
        sku: "KG-TKL-01",
        gtin: "5999-8877-66554",
        description: "Vezeték nélküli mechanikus billentyűzet.",
        images: ["https://cdn.kincsgoblin.hu/tkl.webp"],
        priceMinorAmount: "34990",
        currency: "HUF",
        minorUnit: 0,
        stockStatus: "in_stock",
        rating: { value: 4.8, count: 12 },
      },
    });

    expect(full["@type"]).toBe("Product");
    expect(full.gtin13).toBe("5999887766554");
    expect(full.offers).toMatchObject({
      "@type": "Offer",
      priceCurrency: "HUF",
      price: "34990",
      availability: "https://schema.org/InStock",
    });
    expect(full.aggregateRating).toEqual({
      "@type": "AggregateRating",
      ratingValue: 4.8,
      reviewCount: 12,
    });

    const minimal = buildProductJsonLd({
      brand: gamerBrand,
      product: {
        name: "Teszt",
        slug: "teszt",
        sku: "",
        gtin: "nem-szam",
        description: "",
        images: [],
        priceMinorAmount: "990",
        currency: "HUF",
        minorUnit: 0,
        stockStatus: "out_of_stock",
        rating: { value: 0, count: 0 },
      },
    });
    expect(minimal.gtin13).toBeUndefined();
    expect(minimal.aggregateRating).toBeUndefined();
    expect((minimal.offers as Record<string, unknown>).availability).toBe(
      "https://schema.org/OutOfStock",
    );
  });

  it("renderRobotsTxt élesben engedélyez és Sitemapet ad, nem élesben mindent tilt", () => {
    const prod = renderRobotsTxt(gamerBrand, true);
    expect(prod).toContain("Allow: /");
    expect(prod).toContain("Disallow: /api/");
    expect(prod).toContain(`Sitemap: ${gamerOrigin}/sitemap.xml`);

    const demo = renderRobotsTxt(gamerBrand, false);
    expect(demo).toContain("Disallow: /");
    expect(demo).not.toContain("Sitemap:");
  });

  it("renderUrlSetXml és renderSitemapIndexXml XML-escape-elt, érvényes kimenetet ad", () => {
    expect(escapeXml(`a&b<c>"d"'e'`)).toBe("a&amp;b&lt;c&gt;&quot;d&quot;&apos;e&apos;");

    const urlSet = renderUrlSetXml([
      { loc: "https://kincsgoblin.hu/", lastmod: "2026-04-20T12:00:00Z" },
    ]);
    expect(urlSet).toContain("<urlset");
    expect(urlSet).toContain("<loc>https://kincsgoblin.hu/</loc>");
    expect(urlSet).toContain("<lastmod>2026-04-20T12:00:00Z</lastmod>");

    const index = renderSitemapIndexXml([{ loc: "https://kincsgoblin.hu/sitemap/1.xml" }]);
    expect(index).toContain("<sitemapindex");
    expect(index).toContain("<loc>https://kincsgoblin.hu/sitemap/1.xml</loc>");
  });

  it("oklchToHex érvényes hex színt konvertál Satorihoz, hibánál fallbacket ad", () => {
    expect(oklchToHex("oklch(0.19 0.025 50)", "#000000")).toMatch(/^#[0-9a-f]{6}$/);
    expect(oklchToHex("oklch(0.78 0.14 80)", "#000000")).toMatch(/^#[0-9a-f]{6}$/);
    expect(oklchToHex("#123456", "#000000")).toBe("#123456");
    expect(oklchToHex("invalid", "#abcdef")).toBe("#abcdef");
  });

  it("resolvePublicOgImageUrl tiltja a nem-HTTPS és belső/metadata címeket (SSRF védelem)", () => {
    expect(resolvePublicOgImageUrl("https://cdn.example.com/item.png")).toBe(
      "https://cdn.example.com/item.png",
    );
    expect(resolvePublicOgImageUrl("http://cdn.example.com/item.png")).toBeNull();
    expect(resolvePublicOgImageUrl("https://localhost/a.png")).toBeNull();
    expect(resolvePublicOgImageUrl("https://gamer.localhost/a.png")).toBeNull();
    expect(resolvePublicOgImageUrl("https://127.0.0.1/a.png")).toBeNull();
    expect(resolvePublicOgImageUrl("https://[::1]/a.png")).toBeNull();
    expect(resolvePublicOgImageUrl("https://169.254.169.254/latest/meta-data")).toBeNull();
    expect(resolvePublicOgImageUrl("https://0.0.0.0/a.png")).toBeNull();
    expect(resolvePublicOgImageUrl("https://[fe80::1]/a.png")).toBeNull();
    expect(resolvePublicOgImageUrl("https://[fd00::1]/a.png")).toBeNull();
  });
});
