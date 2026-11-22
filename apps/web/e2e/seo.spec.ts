import { brands, getBrandCanonicalOrigin } from "@kg/brand-config";
import { expect, test, type APIRequestContext } from "@playwright/test";

const GAMER_ORIGIN = getBrandCanonicalOrigin(brands[0]!);
const SAMPLE_PRODUCT_SLUG = "runakard-tkl-pro-vezetek-nelkuli-billentyuzet";
const OLD_PRODUCT_SLUG = "runakard-tkl-regi";

/**
 * Windowson a Node.js `request` API nem oldja fel a `*.localhost` aldomaint DNS-ből,
 * ezért `127.0.0.1`-re küldjük a kérést a `Host: gamer.localhost` fejléccel.
 */
function brandGet(request: APIRequestContext, path: string, options?: { maxRedirects?: number }) {
  const baseUrl = new URL(test.info().project.use.baseURL!);
  return request.get(`http://127.0.0.1:${baseUrl.port}${path}`, {
    ...options,
    headers: { host: baseUrl.host },
  });
}

test("robots.txt és sitemap.xml brandenként elérhető és érvényes", async ({ request }) => {
  const robots = await brandGet(request, "/robots.txt");
  expect(robots.status()).toBe(200);
  expect(robots.headers()["content-type"]).toContain("text/plain");
  // Lokális / nem éles környezetben tiltja az indexelést.
  expect(robots.headers()["x-robots-tag"]).toBe("noindex, nofollow");
  expect(await robots.text()).toContain("Disallow: /");

  const sitemap = await brandGet(request, "/sitemap.xml");
  expect(sitemap.status()).toBe(200);
  expect(sitemap.headers()["content-type"]).toContain("application/xml");
  const xml = await sitemap.text();
  expect(xml).toContain("<urlset");
  expect(xml).toContain(`${GAMER_ORIGIN}/termek/${SAMPLE_PRODUCT_SLUG}`);
  expect(xml).toContain(`${GAMER_ORIGIN}/termekek`);
});

test("főoldal canonical, OpenGraph és Organization + WebSite JSON-LD jelen van", async ({
  page,
}) => {
  await page.goto("/");

  await expect(page.locator('link[rel="canonical"]')).toHaveAttribute(
    "href",
    new RegExp(`^${GAMER_ORIGIN.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}/?$`),
  );
  await expect(page.locator('meta[property="og:title"]')).toHaveAttribute("content", /KincsGoblin/);
  await expect(page.locator('meta[name="twitter:card"]')).toHaveAttribute(
    "content",
    "summary_large_image",
  );

  const jsonLdTypes = await page
    .locator('script[type="application/ld+json"]')
    .evaluateAll((els) =>
      els.map((el) => (JSON.parse(el.textContent ?? "{}") as { "@type"?: string })["@type"]),
    );
  expect(jsonLdTypes).toContain("Organization");
  expect(jsonLdTypes).toContain("WebSite");
});

test("szűrt katalógus canonicalja a szűretlen lista, keresés noindex", async ({ page }) => {
  await page.goto("/termekek?rendezes=ar-novekvo&raktaron=1");
  await expect(page.locator('link[rel="canonical"]')).toHaveAttribute(
    "href",
    `${GAMER_ORIGIN}/termekek`,
  );

  const jsonLdTypes = await page
    .locator('script[type="application/ld+json"]')
    .evaluateAll((els) =>
      els.map((el) => (JSON.parse(el.textContent ?? "{}") as { "@type"?: string })["@type"]),
    );
  expect(jsonLdTypes).toContain("BreadcrumbList");

  await page.goto("/termekek?q=billentyuzet");
  await expect(page.locator('meta[name="robots"]')).toHaveAttribute("content", /noindex/i);
});

test("termékoldal Product + BreadcrumbList JSON-LD-t és OG-képet ad", async ({ page, request }) => {
  await page.goto(`/termek/${SAMPLE_PRODUCT_SLUG}`);

  await expect(page.locator('link[rel="canonical"]')).toHaveAttribute(
    "href",
    `${GAMER_ORIGIN}/termek/${SAMPLE_PRODUCT_SLUG}`,
  );

  const scripts = await page
    .locator('script[type="application/ld+json"]')
    .evaluateAll((els) =>
      els.map((el) => JSON.parse(el.textContent ?? "{}") as Record<string, unknown>),
    );
  const productLd = scripts.find((item) => item["@type"] === "Product");
  expect(productLd).toBeDefined();
  expect(productLd?.offers).toMatchObject({
    "@type": "Offer",
    priceCurrency: "HUF",
  });
  expect(scripts.some((item) => item["@type"] === "BreadcrumbList")).toBe(true);

  const ogImageUrl = await page.locator('meta[property="og:image"]').getAttribute("content");
  expect(ogImageUrl).toBe(`${GAMER_ORIGIN}/termek/${SAMPLE_PRODUCT_SLUG}/opengraph-image`);
  const twitterImageUrl = await page.locator('meta[name="twitter:image"]').getAttribute("content");
  expect(twitterImageUrl).toBe(`${GAMER_ORIGIN}/termek/${SAMPLE_PRODUCT_SLUG}/opengraph-image`);

  const ogPath = new URL(ogImageUrl!).pathname;
  const ogResponse = await brandGet(request, ogPath);
  expect(ogResponse.status()).toBe(200);
  expect(ogResponse.headers()["content-type"]).toContain("image/png");
});

test("átnevezett termék-slug állandó átirányítást, nem létező termék valódi 404-et ad", async ({
  request,
}) => {
  const redirectRes = await brandGet(request, `/termek/${OLD_PRODUCT_SLUG}`, { maxRedirects: 0 });
  expect([301, 308]).toContain(redirectRes.status());
  expect(redirectRes.headers()["location"]).toContain(`/termek/${SAMPLE_PRODUCT_SLUG}`);

  const missingRes = await brandGet(request, "/termek/nincs-ilyen-termek-sehol");
  expect(missingRes.status()).toBe(404);
});
