# packages/woo-client

WooCommerce-kliens: Store API (`@kg/woo-client`), `server-only` REST v3 (`@kg/woo-client/rest`),
Node/Trigger.dev REST v3 (`@kg/woo-client/rest/node`), webhook-aláírás ellenőrzés
(`@kg/woo-client/webhooks`), fixture-ök (`@kg/woo-client/fixtures`) és MSW handlerek
(`@kg/woo-client/msw`).

- **`createWooClient(brand)` (`@kg/woo-client`):** a brandhez kötött Store API belépési pont. A végpontot
  a `brand.woo.baseUrlEnv` környezeti változóból olvassa (hiányzónál/hibásnál `WOO.UNAVAILABLE`, érték
  szivárogtatása nélkül). Támogatja a katalógust (`getProducts`, `getProductById`, `getProductBySlug`,
  `getCategories`, `getAttributes`, `getAttributeTerms`), a kosarat (`getCart`, `addCartItem`,
  `updateCartItem`, `removeCartItem`, `applyCoupon`, `removeCoupon`, `selectShippingRate` + `Cart-Token`
  és `Nonce` fejlécek, mindig `cache: "no-store"`) és a checkoutot (`getCheckout`, `submitCheckout`,
  szintén `cache: "no-store"`).
- **`createWooRestClient(brand)` (`@kg/woo-client/rest` és `@kg/woo-client/rest/node`):** a Next.js
  belépési pont (`@kg/woo-client/rest`) az első sorban importálja a `server-only` csomagot (kliens
  komponensből importálva build-hiba). Non-Next Node futtatókörnyezetből (`apps/jobs` / Trigger.dev) a
  `@kg/woo-client/rest/node` használható (böngészőben futásidejű védelemmel). A `WOO_<BRAND>_CONSUMER_KEY`
  és `_CONSUMER_SECRET` változókat használja; HTTPS-en `Basic` Auth fejléccel, `http://` alatt kizárólag
  `localhost`/`127.0.0.1`/`[::1]` loopback címekre engedett query-paraméteres hitelesítéssel (minden más
  `http://` URL fail-closed `WOO.UNAVAILABLE`). Támogatja a `products/batch`, `products`, `orders` és
  `orders/:id/notes` végpontokat.
- **`verifyAndParseWooWebhook(...)` (`@kg/woo-client/webhooks`):** `X-WC-Webhook-Signature`
  időzítésbiztos HMAC-SHA256 ellenőrzése a nyers bodyn a brand `WOO_<BRAND>_WEBHOOK_SECRET` titkával
  (hiányzó titoknál fail-closed `WooError`). Kezeli a WooCommerce mentéskor küldött aláírás nélküli
  `ping` kérését (`webhook_id=<szám>`, topic header nélkül, mellékhatás nélkül), valamint a `product.*`
  és `order.created`/`order.updated` Zod-sémákat (rossz aláírásnál `401`, payload naplózása nélkül).
- **Hibák:** `WooError` stabil `DOMAIN.REASON` kóddal (`WOO.UNAVAILABLE`, `WOO.INVALID_RESPONSE`,
  `WOO.CONTRACT_MISMATCH`, `CART.OUT_OF_STOCK`, `CART.INVALID_QUANTITY`, `CART.COUPON_INVALID`,
  `CART.SESSION_INVALID`, `CHECKOUT.VALIDATION_FAILED`). A `WooError.message` belső diagnosztikára való;
  a felhasználó mindig a hibakatalógus szövegét kapja.
- **`@kg/woo-client/fixtures` és `@kg/woo-client/msw`:** valódi, a lokális KG-4 Woo-ból mentett válaszok
  és MSW handlerek Woo nélküli tesztekhez. Lokális Docker-Woo contract-teszt:
  `pnpm --filter @kg/woo-client test:contract`.

Szabályok: `.agents/skills/kg-architecture/references/woo-integration.md`.

## Ismert furcsaságok

- 2026-11-12: a Store API az árakat stringként, minor unitban adja (`"16990"`, `currency_minor_unit: 0` HUF-nál).
- 2026-11-12: a `short_description` és a `description` HTML; a frontend sanitizer nélkül nem renderelheti.
- 2026-11-12: a seed-termékeknek nincs képe (`images: []`), tagje és attribútuma.
- 2026-11-15: a REST v3 kliens `http://` alatt biztonsági okból csak loopback (`localhost`, `127.0.0.1`, `[::1]`) címeket enged query-paraméteres kulccsal; külső vagy éles HTTP-végponton elutasítja a hívást.
