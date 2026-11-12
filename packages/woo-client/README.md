# packages/woo-client

Állapot: csak terv.

Brandenként példányosítható WooCommerce-kliens (`createWooClient(brand)`):

- `store` belépési pont: Store API (termékek, kategóriák, kosár, checkout), Cart-Token kezelés;
- `admin` belépési pont (`server-only`): REST v3 consumer key/secret-tel - csak szerveren és a jobokban;
- `schemas`: Zod-sémák minden használt válaszra és webhook-payloadra;
- `webhook`: `X-WC-Webhook-Signature` ellenőrzés (HMAC-SHA256, időzítésbiztos összehasonlítás);
- hibaképzés saját kódokra (`WOO.*`, `CART.*`, `CHECKOUT.*`).

Szabályok: `.agents/skills/kg-architecture/references/woo-integration.md`.

## Ismert furcsaságok

<!-- Próbahívással talált Woo- és plugin-viselkedés ide, dátummal. -->
