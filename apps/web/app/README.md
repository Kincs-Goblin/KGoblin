# app/ - Next.js App Router (csak routing)

Ez a Next.js routing-mappája, **nem** az FSD `app` rétege (az a `src/app`).

- `page.tsx`, `layout.tsx`, `generateMetadata`: csak re-export vagy vékony kompozíció a `src/pages`-ből.
- `route.ts`: vékony - validál, meghív egy függvényt a `src`-ből vagy a `packages/*`-ból, választ ad.
- Üzleti logika, Woo-hívás, JSX-blokk itt nem lehet.

Tervezett szerkezet:

```
[brand]/                  a proxy a domainből írja át ide
  layout.tsx              brand-config betöltése, téma
  page.tsx                → src/pages/home
  kategoria/[...slug]/    → src/pages/catalog
  termek/[slug]/          → src/pages/product
  kereses/                → src/pages/search
  kosar/                  → src/pages/cart
  penztar/                → src/pages/checkout
  rendeles/[id]/          → src/pages/order-confirmation
  fiok/                   → src/pages/account
  belepes/  regisztracio/ → src/pages/auth
  [legal]/                → src/pages/legal (ÁSZF, adatkezelés, szállítás)
api/
  webhooks/woo/[brand]/   Woo webhook: aláírás, Zod, revalidateTag, Trigger.dev task
  revalidate/             kézi revalidálás, titokkal védve
```
