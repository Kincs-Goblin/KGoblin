# Hova kerüljön a kód

## Next.js + FSD összekötése (`apps/web`)

```
apps/web/
  app/                    Next App Router - CSAK routing
    [brand]/              a proxy a domainből ide írja át a kérést
      (shop)/page.tsx     export { HomePage as default } from "@/pages/home"
      termek/[slug]/page.tsx
      kategoria/[...slug]/page.tsx
      kosar/  penztar/  fiok/  kereses/  rendeles/[id]/
    api/
      webhooks/woo/[brand]/route.ts   vékony: aláírás, Zod, revalidateTag, task indítása
      revalidate/route.ts             kézi revalidálás (titokkal védve)
  pages/README.md         üres mappa: megakadályozza, hogy a Next a src/pages-t Pages Routernek vegye
  proxy.ts                domain → brand rewrite (Next 16 előtt: middleware.ts)
  src/                    FSD-rétegek
```

- A `page.tsx`, `layout.tsx` és `generateMetadata` csak re-export vagy vékony kompozíció a `src/pages`-ből.
- Magyar, SEO-barát URL-ek (`/termek/<slug>`, `/kategoria/<slug>`); URL-szerkezet változtatása major
  változás (301-es átirányítással), csak kérésre.
- `generateStaticParams` brandenként a legnépszerűbb termékekre és minden kategóriára; a többi ISR.

## Rétegek és tervezett szeletek

| Réteg | Mire | Tervezett szeletek (kiindulás, nem kötelező lista) |
|---|---|---|
| `app` | providerek, globális stílus, brand-téma injektálása, Sentry/PostHog init | - (nem szeletelt) |
| `pages` | egy útvonal kompozíciója, logika nélkül | `home`, `catalog`, `product`, `search`, `cart`, `checkout`, `order-confirmation`, `account`, `auth`, `legal`, `not-found` |
| `widgets` | több oldalon visszatérő nagy blokk | `header`, `footer`, `mega-menu`, `product-grid`, `product-gallery`, `cart-drawer`, `checkout-summary`, `filter-panel` |
| `features` | felhasználói művelet (űrlap, gomb + mutáció) | `add-to-cart`, `update-cart-item`, `apply-coupon`, `filter-products`, `search-products`, `select-shipping`, `select-payment`, `submit-checkout`, `auth-login`, `auth-register`, `auth-logout` |
| `entities` | üzleti entitás: típus, lekérés, megjelenítés | `product`, `category`, `cart`, `order`, `customer`, `brand` |
| `shared` | brand- és üzletfüggetlen alap | `ui` (shadcn), `lib` (pénzformázás, hibakódok, analytics-segéd), `api` (Woo-kontextus, cache-tagek), `config` (env-séma, útvonalak) |

Szeletet akkor hozz létre, amikor az első valódi kód megjelenik; üres szeletet ne commitolj.

## Melyik kód hová

| Mit írsz | Hely |
|---|---|
| Útvonal / oldal | `app/[brand]/…/page.tsx` → re-export a `src/pages/<oldal>/ui/<Oldal>Page.tsx`-ből |
| Termék lekérése (RSC) | `entities/product/api/get-product.ts` (`server-only`), export az `index.server.ts`-ből |
| Termékkártya | `entities/product/ui/ProductCard.tsx` |
| Kosárba tétel | `features/add-to-cart/api/add-to-cart.action.ts` (`"use server"`) + `ui/AddToCartButton.tsx` |
| Checkout beküldése | `features/submit-checkout/` (Zod-űrlapséma a `model/`-ben, action az `api/`-ban) |
| Kosár-drawer | `widgets/cart-drawer/` (összerakja a `cart` entitást és a cart-featureöket) |
| Webhook | `app/api/webhooks/woo/[brand]/route.ts` (vékony) → `packages/woo-client` aláírás + séma |
| Woo HTTP-kliens, Zod-sémák | `packages/woo-client` (nem az appban) |
| Brand-config, tokenek | `packages/brand-config`; az appban csak a `shared/config` olvassa |
| shadcn komponens | `shared/ui/` (`pnpm dlx shadcn add …`, utána tokenekre igazítva) |
| Pénzformázás, dátum | `shared/lib/format/` |
| Env-változók sémája | `shared/config/env.ts` (Zod, külön server és client séma) |
| Szövegek | a szelet `config/texts.ts`-e vagy a brand texts; JSX-be nem írunk szöveget |
| Típusok | a szelet `model/types.ts`-e; komponensfájlban nem definiálunk megosztott típust |
| Háttérmunka (email, beszállító, számla) | `apps/jobs` (lásd `jobs-and-suppliers.md`), a webből csak a task indítása |

## Tesztek helye

A tesztfájl a forrás mellé kerül (`*.test.ts`), a Steiger ignorálja. E2e: `apps/web/e2e/`. Woo-mockok:
`packages/woo-client/test/fixtures/` (valódi, anonimizált Store API-válaszokból).
