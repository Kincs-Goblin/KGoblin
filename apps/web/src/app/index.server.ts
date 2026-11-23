import "server-only";

// Route handlerek belépési pontja: az `index.ts` a RootLayouton át a `next/font`-ot is behúzza, aminek a
// CSS-e (woff2-hivatkozásokkal) route handler bundle-ben az OpenNext esbuild-buildjét megtöri.
export { buildBrandSitemapEntries } from "./seo/build-sitemap";
