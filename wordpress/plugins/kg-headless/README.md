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
       "currency_minor_unit": 0
     }
     ```

## Kötelező harmadik féltől származó bővítmények (brandenként azonos verzióval)

| Bővítmény | Slug | Szerep |
|---|---|---|
| WooCommerce | `woocommerce` | Alap kereskedelmi motor, Store API, REST v3, HPOS |
| Redis Object Cache | `redis-cache` | Object cache a gyors Store API és REST válaszokhoz |
