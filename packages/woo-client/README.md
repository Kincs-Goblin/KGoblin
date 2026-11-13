# packages/woo-client

WooCommerce-kliens. Jelenleg a Store API olvasó része van kész (KG-5); a kosár, a checkout, a REST v3
(`server-only`) és a webhook-aláírás a következő ticketekben jön.

- `createStoreClient({ baseUrl })`: `getProducts`, `getProductBySlug`, `getCategories`. Minden válasz Zod-sémán
  megy át (`src/store/schemas.ts`). A Next `fetch` cache-opciói (`revalidate`, `tags`) átadhatók.
- Hibák: `WooError` a `code` mezővel - `WOO.UNAVAILABLE` (hálózat, timeout, nem 2xx), `WOO.CONTRACT_MISMATCH`
  (a válasz nem felel meg a sémának).
- `@kg/woo-client/fixtures`: valódi, a lokális KG-4 Woo-ból mentett válaszok és egy fixture-kliens Woo nélküli
  futáshoz (CI e2e, Docker nélküli fejlesztés). Frissítés: a lokális stack indítása után
  (`kg-dev-practices/references/local-stack.md`) `curl …/wp-json/wc/store/v1/products?per_page=100 > test/fixtures/products.json`.

Szabályok: `.agents/skills/kg-architecture/references/woo-integration.md`.

## Ismert furcsaságok

- 2026-11-12: a Store API az árakat stringként, minor unitban adja (`"16990"`, `currency_minor_unit: 0` HUF-nál).
- 2026-11-12: a `short_description` és a `description` HTML; a frontend sanitizer nélkül nem renderelheti.
- 2026-11-12: a seed-termékeknek nincs képe (`images: []`), tagje és attribútuma.
