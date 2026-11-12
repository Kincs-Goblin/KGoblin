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

A WordPress oldali kiegészítések egy saját pluginban: Store API-kiterjesztések, webhook-beállítások,
CORS lezárása (csak a Next szerver hívhatja a REST v3-at), headless-beállítások (a frontend URL-je a jelszó-
visszaállító és email linkekben). Más pluginhez nem nyúlunk; a harmadik féltől származó pluginek listája és
verziója a plugin README-jében van.
