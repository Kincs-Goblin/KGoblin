# WooCommerce-integráció

## Melyik API mire

| Feladat | API | Hol fut | Hitelesítés |
|---|---|---|---|
| Termék, kategória, attribútum, keresés listázása | Store API `/wp-json/wc/store/v1/products…` | RSC, ISR-rel | nincs |
| Kosár olvasása és módosítása | Store API `/cart`, `/cart/add-item`, `/cart/update-item`, `/cart/apply-coupon` | server action | `Cart-Token` header (httpOnly cookie-ból) |
| Checkout | Store API `/checkout` | server action | `Cart-Token` |
| Bejelentkezett vásárló adatai, rendelései | REST v3 vagy auth plugin endpoint | server | vásárlói token (httpOnly cookie) |
| Termék-upsert, készlet, rendelés-státusz, rendelés-megjegyzés | REST v3 `/wp-json/wc/v3/…` | csak `apps/jobs` vagy server | consumer key/secret |
| Változásértesítés | Woo webhook → `app/api/webhooks/woo/[brand]` | route handler | HMAC-aláírás |

A kliens a `packages/woo-client`, brandenként példányosítva (`createWooClient(brand)`): Store API és REST v3
külön belépési pontban, a REST v3 `server-only`.

## Szabályok

- **Minden válasz Zod-sémán megy át.** Ismeretlen mező nem hiba (`passthrough` helyett `strip`), hiányzó
  kötelező mező viszont `WOO.CONTRACT_MISMATCH` hiba, Sentry-eseménnyel.
- **Ár:** a Store API `prices` objektuma minor unitban adja az árat (`currency_minor_unit`). A formázást a
  `shared/lib/format` végzi; összeadás, kedvezményszámítás a kliensen tilos.
- **Kosár:** az első kosárművelet `Cart-Token`-t ad; ezt brandenként külön, httpOnly, Secure, SameSite=Lax
  cookie-ban tároljuk. A kosár nem cache-elt (`no-store`). Bejelentkezéskor a vendégkosár összevonásának
  módja az auth plugin döntésétől függ (nyitott).
- **Checkout és fizetés:** a Store API `/checkout` `payment_method` + `payment_data` mezőkkel megy.
  Átirányításos gatewaynél (Barion, SimplePay) a válasz `payment_result.redirect_url`-jére irányítunk, a
  visszatérés a rendelés-visszaigazoló oldalra jön, és a **státuszt mindig a Woo-tól kérdezzük le**, nem
  az URL-paraméterből hisszük el. Stripe: a kártyaadat a Stripe.js-en megy (publishable key), a Woo csak
  a payment method ID-t kapja.
  - Kockázat: minden gateway pluginnél korán ellenőrizni kell a Store API (block checkout) támogatást;
    erre külön spike-ticket kell.
- **Fizetés idempotenciája:** dupla kattintás és újrapróba nem indíthat két checkoutot. A gomb tiltása
  kevés: a server action is ellenőrzi, hogy fut-e már checkout az adott kosárra.
- **Jogi elemek** (Omnibus 30 napos legalacsonyabb ár, ÁSZF-elfogadás, cégadat-validálás) a Woo oldalon
  számolódnak, és Store API-kiterjesztésként (`ExtendSchema`) jönnek a saját `kg-headless` pluginból.
  A frontend nem számolja őket.

## Cache és revalidálás

- Cache-tagek **brand-előtaggal**: `product:<brand>:<id>`, `category:<brand>:<id>`, `products:<brand>`,
  `menu:<brand>`. A tagképzés egy helyen van (`shared/api/cache-tags.ts`).
- Katalógusoldal: ISR, alapból hosszú revalidate, a frissítést a webhook adja.
- Webhook-route lépései: nyers body beolvasása → `X-WC-Webhook-Signature` ellenőrzése (base64 HMAC-SHA256 a
  brand webhook-titkával, időzítésbiztos összehasonlítással) → Zod → `revalidateTag` → nehéz munkánál
  Trigger.dev task indítása → gyors 2xx. Érvénytelen aláírás: 401, naplózva, a body nem.
- A Woo webhook „ping” és ismételt kézbesítés esetén is idempotensen viselkedjen.

## Hibák és kiesés

- Woo-időtúllépés vagy 5xx: `WOO.UNAVAILABLE`, a katalógus a cache-ből szolgál ki, a kosár és a checkout
  érthető hibaüzenetet ad.
- 4xx a Store API-tól (pl. készlethiány, érvénytelen kupon): a Woo hibakódját saját kódra képezzük
  (`CART.OUT_OF_STOCK`, `CART.COUPON_INVALID`), a felhasználó emberi szöveget lát.
- Próbahívással derülnek ki a furcsaságok; ezeket a `packages/woo-client/README.md` „Ismert furcsaságok”
  részébe írd.

## Saját WP plugin (`kg-headless`)

A WordPress oldali kiegészítések egy saját pluginban (`wordpress/plugins/kg-headless/`): Store API-kiterjesztések,
webhook-beállítások, CORS lezárása (csak a Next szerver hívhatja a REST v3-at), headless-beállítások (a nem-admin
kérések `302` átirányítása a `KG_FRONTEND_URL` storefrontra, valamint a rendelés-visszaigazoló URL átírása).
Más pluginhez nem nyúlunk; a harmadik féltől származó pluginek listája és verziója a plugin README-jében van.

### `kg-headless` Store API mezők

1. **Termék végpont (`/wp-json/wc/store/v1/products` → `extensions.kg_headless`):**
   - `lowest_price_30_days` (`int | null`): Az akció kezdete előtti 30 nap legalacsonyabb ára minor unitban (HUF esetén egész Ft, float nélkül számolva; az aktuális akciós ár nem számít bele).
   - `is_on_sale` (`boolean`): A termék jelenleg akciós-e.
   - `currency_minor_unit` (`int`): A pénznem tizedesjegyeinek száma (`0` HUF esetén).

2. **Checkout végpont (`POST /wp-json/wc/store/v1/checkout` → `extensions.kg_headless` vagy `additional_fields`):**
   - `is_company` (`boolean`): Céges számla igénylése.
   - `company_name` (`string`): Cégnév (`is_company: true` esetén kötelező).
   - `tax_number` (`string`): Magyar adószám (`12345678-2-42` vagy 11 számjegy; `is_company: true` esetén kötelező és szerveroldalon validált).
   - `accept_terms` (`boolean`, kötelezően `true`): ÁSZF és Adatkezelési tájékoztató elfogadása.
   - `accept_payment_obligation` (`boolean`, kötelezően `true`): Fizetési kötelezettség tudomásulvétele.
   - **Store API 400 hibakódok:** `kg_terms_not_accepted`, `kg_payment_obligation_not_accepted`, `kg_missing_company_name`, `kg_missing_tax_number`, `kg_invalid_tax_number`.
   - **HPOS rendelés-metaadatok:** `_billing_is_company`, `_billing_company_name`, `_billing_tax_number`, `_hu_accepted_terms_privacy`, `_hu_accepted_payment_obligation`, `_hu_legal_accepted_at`.

