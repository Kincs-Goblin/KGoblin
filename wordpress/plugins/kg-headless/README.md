# `kg-headless` – KGoblin Headless WooCommerce Plugin

A `kg-headless` a KGoblin multi-brand platform saját WordPress / WooCommerce bővítménye. Minden brand WooCommerce-példányában aktívnak kell lennie.

## Funkciók

1. **Headless frontend átirányítás:**
   - Minden nem-admin (`!is_admin()`), nem-REST (`/wp-json`), nem-login (`/wp-login.php`) és nem-cron kérést `302`-vel átirányít a brand Next.js storefront URL-jére (`KG_FRONTEND_URL` környezeti változó vagy `kg_headless_frontend_url` option).
2. **Store API Checkout kiterjesztés és magyar jogi validáció (`/wp-json/wc/store/v1/checkout`):**
   - Regisztrálja az `additional_fields` (`kg-headless/*`) és az `extensions.kg_headless` mezőket:
     - `is_company` (`boolean`): Céges számla igénylése
     - `company_name` (`string`): Cégnév (kötelező, ha `is_company: true`)
     - `tax_number` (`string`): Magyar adószám (`12345678-2-42` vagy 11 számjegy, kötelező és validált, ha `is_company: true`)
     - `accept_terms` (`boolean`, kötelezően `true`): ÁSZF és Adatkezelési tájékoztató elfogadása
     - `accept_payment_obligation` (`boolean`, kötelezően `true`): Fizetési kötelezettség tudomásulvétele (45/2014. (II. 26.) Korm. rendelet)
   - Hibás vagy hiányzó adatnál HTTP `400 Bad Request` választ ad egyértelmű hibakóddal (`kg_terms_not_accepted`, `kg_payment_obligation_not_accepted`, `kg_missing_company_name`, `kg_missing_tax_number`, `kg_invalid_tax_number`).
   - HPOS-kompatibilis mentés a `WC_Order` objektumon:
     - `_billing_is_company` (`yes` / `no`)
     - `_billing_company_name`
     - `_billing_tax_number`
     - `_hu_accepted_terms_privacy` (`yes`)
     - `_hu_accepted_payment_obligation` (`yes`)
     - `_hu_legal_accepted_at` (ISO-8601 UTC időbélyeg)
3. **EU Omnibus 30 napos legalacsonyabb ár (float-mentes):**
   - Termékmentéskor (`woocommerce_before_product_object_save`, beleértve a REST v3 feed-szinkront is) egész számként (minor unit / Ft) naplózza az ártörténetet (`_hu_price_history`).
   - Akciós terméknél a referenciaár az **akció kezdete (`_hu_sale_started_at`) előtti 30 nap** legalacsonyabb ára (`_hu_lowest_price_30_days`), amelybe az aktuális akciós ár nem számít bele.
   - Store API `/wp-json/wc/store/v1/products` válaszban az `extensions.kg_headless` alatt érhető el:
     ```json
     {
       "lowest_price_30_days": 18990,
       "is_on_sale": true,
       "currency_minor_unit": 0,
       "delivery_time": "1–3 munkanap",
       "gtin": "5999887766554",
       "date_modified_gmt": "2026-04-20T12:00:00Z",
       "variations": []
     }
     ```
     - Változatos termékeknél a `variations` tömb tartalmazza az elérhető variációk `id`, `sku`, `attributes`, `prices`, `on_sale`, `lowest_price_30_days`, `is_in_stock`, `is_on_backorder`, `is_purchasable`, `low_stock_remaining`, `delivery_time` és `image` mezőit.
     - Várható szállítási idő forrása: `_kg_delivery_time` (variáció vagy szülő) → `_kg_supplier_delivery_time` → előrendelés/alapértelmezett `kg_headless_default_delivery_time`.
     - A `gtin` a WooCommerce beépített `global_unique_id` (vagy `_kg_ean` / `_ean` meta) értékét adja vissza strukturált adat (`Product` JSON-LD) számára; a `date_modified_gmt` az ISO-8601 UTC módosítási idő a `sitemap.xml` `<lastmod>` mezőjéhez.
4. **Régi termék-slug átirányítás (`GET /wp-json/kg/v1/redirects`):**
   - Publikus, csak olvasó végpont (`type=product`, `slug=<regi-slug>`), amely a WordPress `_wp_old_slug` postmeta bejegyzése alapján feloldja az átnevezett publikus termékek új slugját:
     - Találat esetén: `{"found": true, "type": "product", "from": "regi-slug", "to": "uj-slug", "status": 301}`
     - Ha nincs találat: `{"found": false, "type": "product", "from": "regi-slug", "to": null, "status": null}`
   - A Next.js termékoldal csak akkor hívja meg, ha az aktuális slug nem található, így normál betöltésnél nincs extra kérés.

## Kötelező harmadik féltől származó bővítmények (brandenként azonos verzióval)

| Bővítmény | Slug | Tesztelt verzió | Státusz | Szerep |
|---|---|---|---|---|
| WooCommerce | `woocommerce` | `11.3.0` | aktív (`setup.ps1`/`setup.sh`) | Alap kereskedelmi motor, Store API, REST v3, HPOS |
| Redis Object Cache | `redis-cache` | `3.0.0` | aktív (`setup.ps1`/`setup.sh`) | Object cache a gyors Store API és REST válaszokhoz |
| WooCommerce Stripe Gateway | `woocommerce-gateway-stripe` | `11.2.0` | tervezett (`KG-13`, ADR-0017) | Stripe UPE (kártya, Wallet) Store API-val és `@stripe/stripe-js`-szel |
| Pay via Barion for WooCommerce | `pay-via-barion-for-woocommerce` | `3.10.2` | tervezett (`KG-13`, ADR-0017) | Barion átirányításos fizetés és IPN (`/?wc-api=wc_gateway_barion`) |
| Payment Gateway for SimplePay | `wpxpert-payment-gateway-for-simplepay` | `0.2.1` | tervezett (`KG-13`, ADR-0017) | OTP SimplePay v2.1 kártya (`simplepay`) és azonnali átutalás (`simplepay_wire`) |

> **KG-13 TODO:** A Stripe és a SimplePay visszatéréskor `wp_safe_redirect($this->get_return_url($order))`-t hív, ezért a `KG_FRONTEND_URL` hostját fel kell venni az `allowed_redirect_hosts` filterbe, valamint a sikertelen/megszakított visszatérés `wc_add_notice` hibáit (pl. SimplePay `transactionId`) query paraméterrel kell továbbítani a storefront felé.
