# packages/woo-client

WooCommerce-kliens: Store API (`@kg/woo-client`), `server-only` REST v3 (`@kg/woo-client/rest`),
webhook-aláírás ellenőrzés (`@kg/woo-client/webhooks`), fixture-ök (`@kg/woo-client/fixtures`)
és MSW handlerek (`@kg/woo-client/msw`).

- **`createWooClient(brand)` (`@kg/woo-client`):** a brandhez kötött Store API belépési pont. A végpontot
  a `brand.woo.baseUrlEnv` környezeti változóból olvassa (hiányzónál/hibásnál `WOO.UNAVAILABLE`, érték
  szivárogtatása nélkül). Támogatja a katalógust (`getProducts`, `getProductById`, `getProductBySlug`,
  `getCategories`, `getAttributes`, `getAttributeTerms`), a kosarat (`getCart`, `addCartItem`,
  `updateCartItem`, `removeCartItem`, `applyCoupon`, `removeCoupon`, `selectShippingRate` + `Cart-Token`
  és `Nonce` fejlécek, mindig `cache: "no-store"`) és a checkoutot (`getCheckout`, `submitCheckout`,
  szintén `cache: "no-store"`).
- **`createWooRestClient(brand)` (`@kg/woo-client/rest`):** a Next.js szerveroldali (`server-only`)
  REST v3 belépési pont; az első sorban importálja a `server-only` csomagot (kliens komponensből importálva
  build-hiba). Ha később `apps/jobs` vagy más Node-futtatókörnyezet használja, külön `exports` feltétellel
  bővíthető. A `WOO_<BRAND>_CONSUMER_KEY` és `_CONSUMER_SECRET` változókat használja: HTTPS-en `Basic` Auth
  fejléccel, `http://` alatt kizárólag `localhost`/`127.0.0.1`/`[::1]` loopback címekre engedett one-legged
  OAuth 1.0a (`HMAC-SHA256`) query-aláírással (a `consumer_secret` így HTTP-n sem utazik a hálózaton; minden
  más `http://` URL fail-closed `WOO.UNAVAILABLE`). Támogatja a `products/batch`, `products`, `orders` és
  `orders/:id/notes` végpontokat.
- **`verifyAndParseWooWebhook(...)` (`@kg/woo-client/webhooks`):** `X-WC-Webhook-Signature`
  időzítésbiztos HMAC-SHA256 ellenőrzése a nyers bodyn a brand `WOO_<BRAND>_WEBHOOK_SECRET` titkával
  (hiányzó titoknál fail-closed `WooError`). Kezeli a WooCommerce mentéskor küldött aláírás nélküli
  `ping` kérését (`webhook_id=<szám>`, topic header nélkül, mellékhatás nélkül), valamint a `product.*`
  és `order.created`/`order.updated` Zod-sémákat (rossz aláírásnál `401`, payload naplózása nélkül).
- **Hibák:** `WooError` stabil `DOMAIN.REASON` kóddal (`WOO.UNAVAILABLE`, `WOO.INVALID_RESPONSE`,
  `WOO.CONTRACT_MISMATCH`, `CART.OUT_OF_STOCK`, `CART.INVALID_QUANTITY`, `CART.INVALID_INPUT`,
  `CART.COUPON_INVALID`, `CART.SHIPPING_UNAVAILABLE`, `CART.SESSION_INVALID`, `CHECKOUT.VALIDATION_FAILED`,
  `CHECKOUT.PAYMENT_DECLINED`). A `WooError.message`
  belső diagnosztikára való; a felhasználó mindig a hibakatalógus szövegét kapja.
- **`@kg/woo-client/fixtures` és `@kg/woo-client/msw`:** valódi, a lokális KG-4 Woo-ból mentett válaszok
  és MSW handlerek Woo nélküli tesztekhez. Lokális Docker-Woo contract-teszt:
  `pnpm --filter @kg/woo-client test:contract`.

Szabályok: `.agents/skills/kg-architecture/references/woo-integration.md`.

## Ismert furcsaságok

- 2026-11-12: a Store API az árakat stringként, minor unitban adja (`"16990"`, `currency_minor_unit: 0` HUF-nál).
- 2026-11-12: a `short_description` és a `description` HTML; a frontend sanitizer nélkül nem renderelheti.
- 2026-11-12: a seed-termékeknek nincs képe (`images: []`), tagje és attribútuma.
- 2026-11-15: a WooCommerce `WC_REST_Authentication` csak `is_ssl()` igaz érték mellett fogadja el a `Basic` vagy query-paraméteres `consumer_secret` hitelesítést; sima HTTP-n csak OAuth 1.0a működik (ezért loopback `http://` alatt a REST kliens HMAC-SHA256 OAuth 1.0a-t használ). Éles VPS / Cloudflare Tunnel mögött a WordPressnek felismernie kell az `X-Forwarded-Proto: https` fejlécet, hogy az `is_ssl()` igaz legyen.
- 2026-11-15: vendég rendeléshez a `GET /wc/store/v1/order/{id}` és `POST /wc/store/v1/checkout/{id}` végpontok a `key` mellett a `billing_email` paramétert is kötelezően megkövetelik (WooCommerce `11.3.0` `OrderAuthorizationTrait`).
- 2026-11-15: a Stripe (`woocommerce-gateway-stripe`) `wc-stripe-payment-method` + `wc_stripe_selected_upe_payment_type` `payment_data`-t vár a `/checkout`-ban; a WPXpert SimplePay (`wpxpert-payment-gateway-for-simplepay`) pedig elutasítja a nem HTTPS return URL-t (`The SimplePay return address must be HTTPS.`), így lokális sandboxhoz HTTPS/Tunnel kell.
- 2026-11-16: a termékoldali variációválasztó specifikusság alapján választ (a konkrét attribútum-egyezés megelőzi az üres `"Any"` wildcardot), ami eltér a WooCommerce sorrendfüggő „első egyezés” viselkedésétől (pl. elfogyott konkrét variáció megelőzhet egy készleten lévő `"Any"` variációt). A lokális kosár egyelőre olvasható `variantLabel` sztringként őrzi a választást; a KG-12 Store API `/cart/add-item` szinkronjához majd gépi `variation: [{ attribute, value }]` tömböt is tárolni kell (főleg `"Any"` attribútumoknál).
