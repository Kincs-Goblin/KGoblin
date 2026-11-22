import { getBrandCanonicalOrigin, type Brand } from "@kg/brand-config";

/** A sitemaps.org protokoll szerinti felső korlát egyetlen sitemap-fájlban. */
export const MAX_URLS_PER_SITEMAP = 50_000;

export type SitemapEntry = {
  loc: string;
  lastmod?: string | null;
};

export function escapeXml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

export function renderUrlSetXml(entries: readonly SitemapEntry[]): string {
  const urls = entries
    .map((entry) => {
      const lastmod = entry.lastmod ? `<lastmod>${escapeXml(entry.lastmod)}</lastmod>` : "";
      return `  <url><loc>${escapeXml(entry.loc)}</loc>${lastmod}</url>`;
    })
    .join("\n");

  return [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">',
    urls,
    "</urlset>",
    "",
  ].join("\n");
}

export function renderSitemapIndexXml(
  sitemaps: readonly { loc: string; lastmod?: string | null }[],
): string {
  const items = sitemaps
    .map((item) => {
      const lastmod = item.lastmod ? `<lastmod>${escapeXml(item.lastmod)}</lastmod>` : "";
      return `  <sitemap><loc>${escapeXml(item.loc)}</loc>${lastmod}</sitemap>`;
    })
    .join("\n");

  return [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">',
    items,
    "</sitemapindex>",
    "",
  ].join("\n");
}

export function renderRobotsTxt(brand: Brand, indexable: boolean): string {
  if (!indexable) {
    return ["User-agent: *", "Disallow: /", ""].join("\n");
  }
  const origin = getBrandCanonicalOrigin(brand);
  return [
    "User-agent: *",
    "Allow: /",
    "Disallow: /api/",
    `Sitemap: ${origin}/sitemap.xml`,
    "",
  ].join("\n");
}
