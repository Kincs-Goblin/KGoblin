# WooCommerce-integráció

## Melyik API mire

| Feladat | API | Hol fut | Hitelesítés |
|---|---|---|---|
| Termék, kategória, attribútum, keresés listázása | Store API `/wp-json/wc/store/v1/products…` | RSC, ISR-rel | nincs |
| Kosár olvasása és módosítása | Store API `/cart`, `/cart/add-item`, `/cart/update-item`, `/cart/apply-coupon` | server action | `Cart-Token` header (httpOnly cookie-ból) |
| Checkout | Store API `/checkout` | server action | `Cart-Token` |
| Bejelentkezett vásárló adatai, rendelései | `kg-headless` `/wp-json/kg/v1/auth/*` (tervezett: `KG-15`) és REST v3 | server | vásárlói Access/Refresh JWT (httpOnly cookie) |
| Termék-upsert, készlet, rendelés-státusz, rendelés-megjegyzés | REST v3 `/wp-json/wc/v3/…` | csak `apps/jobs` vagy server | consumer key/secret |
| Változásértesítés | Woo webhook → `app/api/webhooks/woo/[brand]` | route handler | HMAC-aláírás |

A kliens a `packages/woo-client`, brandenként példányosítva (`createWooClient(brand)`): Store API és REST v3
külön belépési pontban, a REST v3 `server-only`.

## Szabályok

- **Minden válasz Zod-sémán megy át.** Ismeretlen mező nem hiba (`passthrough` helyett `strip`), hiányzó
  kötelező mező viszont `WOO.CONTRACT_MISMATCH` hiba (a Sentry-esemény az M5-ben jön, addig szerveroldali log).
- **Ár:** a Store API `prices` objektuma minor unitban adja az árat (`currency_minor_unit`). A formázást a
  `shared/lib/format` végzi; összeadás, kedvezményszámítás a kliensen tilos.
- **Kosár:** az első kosárművelet `Cart-Token`-t ad; ezt brandenként külön, httpOnly, Secure, SameSite=Lax
  cookie-ban tároljuk. A kosár nem cache-elt (`no-store`). A `KG-15` megvalósítása után bejelentkezéskor és
  regisztrációkor a `kg-headless` `/wp-json/kg/v1/auth/*` végpont a kapott vendég `Cart-Token` tételeit
  szerveroldalon egyesíti majd a customer sessionjével (ADR-0016), és visszaadja a customer `Cart-Token`-t.
- **Checkout és fizetés (ADR-0017, tervezett megvalósítás: `KG-13`):** a Store API `/checkout` `payment_method` + `payment_data` mezőkkel fog menni (`KG-62` - `KG-66`):
  - **Barion** (`pay-via-barion-for-woocommerce`): `payment_data` nem kell; külső `payment_result.redirect_url`-re irányít, visszatérés `?wc-api=wc_gateway_barion_return_from_payment` és IPN `?wc-api=wc_gateway_barion`.
  - **SimplePay** (`wpxpert-payment-gateway-for-simplepay`, `simplepay` / `simplepay_wire`): `payment_data` nem kell; külső `payment_result.redirect_url`-re irányít, return `?wc-api=woo_simplepay_return` és IPN `?wc-api=woo_simplepay_ipn`. A `start` hívás szigorúan HTTPS return URL-t követel (lokálisan Cloudflare Tunnel / HTTPS kell), és élesítési előírás a checkouton a SimplePay logó + adattovábbítási nyilatkozat, hiba esetén a `transactionId` megjelenítése.
  - **Stripe** (`woocommerce-gateway-stripe`): UPE deferred intent - a böngészőben a Stripe.js (`@stripe/stripe-js`, `NEXT_PUBLIC_*` publishable key) hozza létre a `PaymentMethod` (`pm_...`) vagy `ConfirmationToken` (`ctoken_...`) azonosítót, és `payment_data`-ként küldjük be (`wc-stripe-payment-method`, `wc_stripe_selected_upe_payment_type`). 3DS `requires_action` esetén a `payment_intent_secret`-re a böngészőben `stripe.handleNextAction` fut, a tartós státuszt a `?wc-api=wc_stripe` webhook adja.
  - **Visszatérés, újrapróba és `kg-headless` (`KG-13`):** a `wp-json` és `/?wc-api=...` végpontok bypassolják a `kg-headless` 302 átirányítását, viszont a Stripe és SimplePay visszatéréskor `wp_safe_redirect($this->get_return_url($order))`-t hív, amihez a `kg-headless`-ben (tervezett: `KG-13`) fel kell venni az `allowed_redirect_hosts` filtert a `KG_FRONTEND_URL` hostjával. Sikertelen visszatéréskor a `wc_add_notice` üzeneteket (pl. SimplePay `transactionId`) query paraméterrel kell továbbítani a Next.js-nek; a WP `order-pay` oldal helyett a Next.js a Store API `GET /wc/store/v1/order/{id}?key=...&billing_email=...` és `POST /wc/store/v1/checkout/{id}` végpontokat fogja használni (a státuszt mindig a Woo-tól kérdezzük le). Mivel a `kg-headless.php` visszatérési URL-je nem tartalmaz és adatvédelmi okból nem is tartalmazhat `billing_email` query paramétert, a vendég `billing_email` kontextusát a Next.js checkout BFF rövid élettartamú, brand-előtagos `httpOnly` cookie-ban tárolja (fallbackkel).
- **Fizetés idempotenciája:** dupla kattintás és újrapróba nem indíthat két checkoutot. A gomb tiltása
  kevés: a server action is ellenőrzi, hogy fut-e már checkout az adott kosárra.
- **Jogi elemek** (Omnibus 30 napos legalacsonyabb ár, ÁSZF-elfogadás, cégadat-validálás) a Woo oldalon
  számolódnak, és Store API-kiterjesztésként (`ExtendSchema`) jönnek a saját `kg-headless` pluginból.
  A frontend nem számolja őket.

## Cache és revalidálás

- Cache-tagek **brand-előtaggal**: `<brand>:catalog`, `<brand>:product-slug:<slug>`, `<brand>:category:<id>`. A tagképzés egy helyen van (`shared/api/cache-tags.ts`). Jelenleg minden termék- vagy kategória-webhook a `<brand>:catalog`-ot is érvényteleníti; egyedi termék-ID szerinti célzott invalidálás és webhook-debounce a KG-14 tömeges feed-szinkron előtt készül el.
- Katalógusoldal: ISR, alapból hosszú revalidate, a frissítést a webhook adja.
- Webhook-route lépései: nyers body beolvasása → `X-WC-Webhook-Signature` ellenőrzése (base64 HMAC-SHA256 a
  brand webhook-titkával, időzítésbiztos összehasonlítással) → Zod → `revalidateTag` → nehéz munkánál
  Trigger.dev task indítása → gyors 2xx. Érvénytelen aláírás: 401, naplózva, a body nem.
- A Woo webhook „ping” és ismételt kézbesítés esetén is idempotensen viselkedjen.

## Hibák és kiesés

- Woo-időtúllépés vagy 5xx: `WOO.UNAVAILABLE`, a katalógus a cache-ből szolgál ki, a kosár és a checkout
  érthető hibaüzenetet ad. Oldalszinten: ISR-oldal (főoldal) futáskor továbbdobja a hibát, így a legutóbbi jó
  oldal marad a cache-ben (hibaállapotot csak buildkor renderel); dinamikus oldal (katalógus, termék) inline
  `ErrorState`-et renderel, és a `generateMetadata` Woo-hibánál `robots: { index: false }`-t ad.
  (A „hiba után a stale oldal marad” viselkedést `next start` igazolta; az OpenNext/Workers incremental
  cache-en a demo-Worker beüzemelésekor kell kikapcsolt Woo mellett kipróbálni.)
- A webhook ma csak `revalidateTag`-et vált ki, ezért az újrajátszás ártalmatlan. Az `order.*` topicok
  feldolgozásakor (rendelés-továbbítás) kötelező a delivery-ID alapú idempotencia, és a mellékhatás csak
  Trigger.dev taskban futhat.
- 4xx a Store API-tól (pl. készlethiány, érvénytelen kupon): a Woo hibakódját saját kódra képezzük
  (`CART.OUT_OF_STOCK`, `CART.COUPON_INVALID`), a felhasználó emberi szöveget lát.
- Próbahívással derülnek ki a furcsaságok; ezeket a `packages/woo-client/README.md` „Ismert furcsaságok”
  részébe írd.

## Saját WP plugin (`kg-headless`)

A WordPress oldali kiegészítések egy saját pluginban (`wordpress/plugins/kg-headless/`): Store API-kiterjesztések,
webhook-beállítások, CORS lezárása (csak a Next szerver hívhatja a REST v3-at), headless-beállítások (a nem-admin kérések `302` átirányítása a `KG_FRONTEND_URL` storefrontra, valamint a
rendelés-visszaigazoló URL átírása; tervezett `KG-13` bővítés: `allowed_redirect_hosts` és gateway-hiba query-továbbítás).
Más pluginhez nem nyúlunk; a harmadik féltől származó pluginek listája és verziója a plugin README-jében van.

### `kg-headless` Store API mezők

1. **Termék végpont (`/wp-json/wc/store/v1/products` → `extensions.kg_headless`):**
   - `lowest_price_30_days` (`int | null`): Az akció kezdete előtti 30 nap legalacsonyabb ára minor unitban (HUF esetén egész Ft, float nélkül számolva; az aktuális akciós ár nem számít bele).
   - `is_on_sale` (`boolean`): A termék jelenleg akciós-e.
   - `currency_minor_unit` (`int`): A pénznem tizedesjegyeinek száma (`0` HUF esetén).
   - `delivery_time` (`string | null`): Szállítási idő szöveg (`_kg_delivery_time` → szülő → `_kg_supplier_delivery_time` → előrendelés/alapértelmezett fallback).
   - `variations` (`array`): Változatos termékeknél az összes publikált variáció (`id`, `sku`, `attributes`, `prices`, `on_sale`, `lowest_price_30_days`, `is_in_stock`, `is_on_backorder`, `is_purchasable`, `low_stock_remaining`, `delivery_time`, `image`).

2. **Checkout végpont (`POST /wp-json/wc/store/v1/checkout` → `extensions.kg_headless` vagy `additional_fields`):**
   - `is_company` (`boolean`): Céges számla igénylése.
   - `company_name` (`string`): Cégnév (`is_company: true` esetén kötelező).
   - `tax_number` (`string`): Magyar adószám (`12345678-2-42` vagy 11 számjegy; `is_company: true` esetén kötelező és szerveroldalon validált).
   - `accept_terms` (`boolean`, kötelezően `true`): ÁSZF és Adatkezelési tájékoztató elfogadása.
   - `accept_payment_obligation` (`boolean`, kötelezően `true`): Fizetési kötelezettség tudomásulvétele.
   - **Store API 400 hibakódok:** `kg_terms_not_accepted`, `kg_payment_obligation_not_accepted`, `kg_missing_company_name`, `kg_missing_tax_number`, `kg_invalid_tax_number`.
   - **HPOS rendelés-metaadatok:** `_billing_is_company`, `_billing_company_name`, `_billing_tax_number`, `_hu_accepted_terms_privacy`, `_hu_accepted_payment_obligation`, `_hu_legal_accepted_at`.

### `kg-headless` tervezett auth végpontok (ADR-0016, `KG-15`)

- Tervezett végpontok (`/wp-json/kg/v1/auth/*`): `POST /login`, `POST /register` (csak `customer` szerepkör), `POST /refresh` (kötelező rotáció), `POST /logout` (refresh törlése + `jti` élesben kötelező Redis tiltólistára vétele), `POST /lost-password` (kizárólag szerveroldali BFF-hitelesítéssel hívható; a nyers kulcs soha nem kerül kliensválaszba, az emailt a `KG-17` Resend task küldi majd) és `POST /reset-password`.
- Tokenek: `HS256` Access JWT (`15 perc`, `jti`, `sub`, `iss`) a WooCommerce beépített `JsonWebToken` osztályával + `30 napos` Refresh Token (`SHA-256` hash). Belépéskor/regisztrációnál a vendég `guest_cart_token` tételei szerveroldalon egyesítésre kerülnek majd a customer sessionjébe.

