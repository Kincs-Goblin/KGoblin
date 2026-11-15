# ADR-0017: Fizetési gateway pluginek (Stripe, Barion, SimplePay) és Store API checkout

- Állapot: elfogadott
- Dátum: 2026-11-15 (frissítve: 2026-11-20)
- Döntéshozók: ricsmond12
- Jóváhagyás: `ricsmond12` választása a 2026-11-15-i „Kezdő ticket kiválasztása” munkamenet két opciós kérdésére („Melyik fizetesi plugin-csomagot es M2 megkozelitest rogzitsuk az ADR-0017-ben a KG-13-hoz?” -> „(Recommended) Ingyenes plugin trio...”; valamint „A felfedezett kg-headless.php hianyossagokat (allowed_redirect_hosts, return/cancel hibakezeles) mikor javitsuk?” -> „(Recommended) Csak dokumentacio + ADR-0017 a KG-32-ben, a kg-headless.php (allowed_redirect_hosts, hiba tovabbitas) modositasa menjen a KG-13-ba”; mindkét kérdés összes opciója és a válaszok a PR-leírásban, az összegzés rögzítve a 2026-11-15T22:22:21+0100-as [KG-32](https://kincsgoblin.atlassian.net/browse/KG-32) Jira-kommentben); az ADR 2026-11-20-i pontosításainak megerősítése a PR merge-hez adott „mehet”-tel (`kg-stack` 4-5.)
- Ticket: KG-32
- Kapcsolódik: ADR-0001 (Kezdő stack)

## Kontextus

- Az ADR-0001 és a `kg-stack` szerint a fizetés a Stripe, Barion és SimplePay WooCommerce gateway pluginjeivel, a Store API `/wp-json/wc/store/v1/checkout` végpontján keresztül működik. A projektterv korai kockázatként jelölte, hogy ezek a pluginek valóban támogatják-e a headless Store API-t és a HPOS-t.
- A KG-32 spike keretében (2026-11-15) a lokális Docker WooCommerce `11.3.0` (HPOS aktív, `wordpress/plugins/kg-headless/kg-headless.php` `0.1.0` aktív) környezetben megvizsgáltuk a WooCommerce Store API (`Legacy::process_legacy_payment`, `CheckoutTrait`, `CheckoutOrder`, `Order`, `OrderAuthorizationTrait`) viselkedését, valamint a három ingyenes WordPress.org plugin forráskódját és élő végpontjait (a teszt után a konténer visszaállt tiszta alapra, gateway plugin-maradvány nélkül):
  - `woocommerce-gateway-stripe` (`11.2.0`)
  - `pay-via-barion-for-woocommerce` (`3.10.2`)
  - `wpxpert-payment-gateway-for-simplepay` (`0.2.1`)
- **Külső rendszer-korlát (nem ellenőrzött élő sandbox):** sandbox API-kulcsok a 2026-11-15-i spike idején még nem álltak rendelkezésre, ezért a valódi banki átirányítási URL-t, a Stripe 3DS `requires_action` lefutást és az aláírt IPN/webhook `pending -> processing` státuszváltást **élő kulccsal nem ellenőriztük**. A próba a külső gateway HTTP-határáig (`api.test.barion.com` -> `AuthenticationFailed`, `api.stripe.com` -> `Invalid API Key`, SimplePay `The SimplePay return address must be HTTPS.` ellenőrzés), valamint forráskód- és élő WordPress routing-próbákig (`/?wc-api=...`, `/order-pay/`, `GET /wc/store/v1/order/{id}?key=...&billing_email=...`) jutott el.

### Gateway-besorolás (KG-32 eredmény)

| Gateway | Plugin (tesztelt verzió) | Besorolás | Store API `/checkout` szerződés | Fő buktatók headless módban |
| --- | --- | --- | --- | --- |
| **Barion** | `pay-via-barion-for-woocommerce` (`3.10.2`) | **Működik** (apró kerülőúttal hibakezelésnél) | `payment_method: "barion"`, `payment_data` nem kell; külső `redirect_url`-t ad vissza | Hibás/megszakított visszatéréskor `wc_add_notice` + cart/cancel URL megy a `kg-headless` 302-re (notice elvész); pixel modul PHP warning konfiguráció előtt |
| **Stripe** | `woocommerce-gateway-stripe` (`11.2.0`) | **Kerülőúttal működik** (Stripe.js + `kg-headless` fix) | UPE deferred intent: böngészőben `Stripe.js` (`pm_...` vagy `ctoken_...`), majd `payment_data: [{key: "wc-stripe-payment-method", ...}, {key: "wc_stripe_selected_upe_payment_type", ...}]` | `wp_safe_redirect($this->get_return_url($order))` `allowed_redirect_hosts` nélkül `/wp-admin/`-ra esik; BFF-módban a `wc_stripe_verify_intent` AJAX nonce WP-sessionhöz kötött, ezért 3DS-nél a Next.js-ben `stripe.handleNextAction` + webhook (`?wc-api=wc_stripe`) szükséges |
| **SimplePay** | `wpxpert-payment-gateway-for-simplepay` (`0.2.1`, v2.1) | **Kerülőúttal működik** (`kg-headless` fix + HTTPS + jogi UI) | `payment_method: "simplepay"` (vagy `"simplepay_wire"`), `payment_data` nem kell; külső `redirect_url`-t ad vissza | `wp_safe_redirect($this->get_return_url($order))` `allowed_redirect_hosts` nélkül eltörik; a `start` hívás szigorúan HTTPS return URL-t követel; SimplePay go-live kötelező frontend UI (logó + adattovábbítási nyilatkozat + `transactionId` hiba esetén); nincs Apple/Google Pay/qvik/kétlépcsős fizetés |

## Döntés

1. **Kiválasztott plugin-csomag (0 Ft/év licencdíj; tervezett telepítés és konfigurálás brandenként azonos verziókkal a `KG-13`-ban, `wordpress/docker/setup.{ps1,sh}` és seed):**
   - **Stripe:** `woocommerce-gateway-stripe` (hivatalos WooCommerce plugin, `11.2.0`+)
   - **Barion:** `pay-via-barion-for-woocommerce` (ingyenes Barion plugin, `3.10.2`+)
   - **SimplePay:** `wpxpert-payment-gateway-for-simplepay` (ingyenes SimplePay v2.1 plugin, `0.2.1`+, `simplepay` kártya és opcionálisan `simplepay_wire` azonnali átutalás)
   - **Stripe kliensoldali SDK (tervezett telepítés: `KG-13` / `KG-63`):** `@stripe/stripe-js` kizárólag a böngészőben történő kártyatokenizálásra (publishable key `NEXT_PUBLIC_*` / `brand-config`; semmilyen fizetési titkos kulcs nem kerülhet a Next.js-be).

2. **Tervezett megvalósítási architektúra (`KG-13`, `KG-61` - `KG-67`):**
   - **Store API-központú checkout és újrapróba (`KG-62`, `KG-66`):** A WordPress HTML `order-pay` oldal helyett (amelyet a `kg-headless.php:86-122` `template_redirect` már `302`-vel a Next.js-re irányít) a Store API `POST /wp-json/wc/store/v1/checkout`, az újrapróbához a `POST /wp-json/wc/store/v1/checkout/{id}`, a rendelésstátuszhoz és visszatérési ellenőrzéshez pedig a `GET /wp-json/wc/store/v1/order/{id}?key=...&billing_email=...` végpontot fogjuk használni (vendég rendelésnél a Woo `11.3.0` `OrderAuthorizationTrait` a `key` mellett a `billing_email` paramétert is megköveteli).
   - **Vendég `billing_email` kontextus PII szivárgása nélkül (`KG-62`, `KG-66`):** A meglévő `wordpress/plugins/kg-headless/kg-headless.php` (`127-140.` sor) jelenleg `%s/rendeles-visszaigazolas/%d?key=%s` URL-re írja át a return címet, tehát `billing_email` nincs benne, és adatvédelmi okból nem is kerülhet URL query paraméterbe. A `KG-13`-ban ezért a Next.js checkout BFF rövid élettartamú, brand-előtagos `httpOnly; Secure; SameSite=Lax` cookie-ban fogja őrizni a vendég checkout `order_id` + `billing_email` párját a fizetési visszatérésig (ennek lejárata vagy más eszköz/böngésző esetén email-megerősítő fallbackkel), így szerveroldalon biztonságosan hívhatja a Store API `order/{id}` és `checkout/{id}` végpontokat.
   - **Callback / IPN / webhook végpontok (`KG-63`, `KG-64`, `KG-65`):** A gatewayek `/?wc-api=...` végpontjai (`wc_gateway_barion`, `wc_stripe`, `woo_simplepay_ipn`, return handlerek) a WordPress `parse_request` fázisában futnak le a `kg-headless` `template_redirect` átirányítása előtt, így külön útvonal-kivétel nélkül elérhetők (lokális sandboxhoz Cloudflare Tunnel / HTTPS szükséges a SimplePay HTTPS-követelménye miatt).
   - **`kg-headless` tervezett kiegészítései (`KG-13`):**
     - `allowed_redirect_hosts` filter felvétele a `KG_FRONTEND_URL` hostjával (`kg-headless.php`-ban jelenleg még nincs), hogy a Stripe és a SimplePay `wp_safe_redirect($this->get_return_url($order))` hívása ne blokkolódjon.
     - Sikertelen/megszakított visszatéréskor a releváns hibakód (és SimplePay `transactionId`) query paraméteres továbbítása a Next.js checkout/újrapróba oldal felé, mivel a `wc_add_notice` WP-sessionben marad (a végleges státuszt továbbra is mindig a Woo Store API-tól kérdezzük le, nem query-paraméterből).
   - **Stripe 3DS BFF-folyamat (`KG-63`):** A Store API válasza `payment_result.payment_details`-ben visszaadja a `payment_intent_secret`-et; ha `requires_action` szükséges, a böngészőben a `Stripe.js` (`handleNextAction`) fut le, a rendelés tartós státuszát pedig a Stripe webhook (`?wc-api=wc_stripe`) és a Store API `/order/{id}` lekérdezés szinkronizálja.
   - **SimplePay élesítési UI követelmények (`KG-65`):** A Next.js checkouton a fizetés előtt meg kell jeleníteni a SimplePay elfogadói logót (tájékoztató linkkel) és az adattovábbítási nyilatkozatot, sikertelen visszatéréskor pedig a SimplePay `transactionId`-t.

## Következmények

- **Előnyök:** nincs brandenkénti éves plugin-licencköltség; minden kiválasztott plugin nyílt forrású és támogatja a Store API-t + HPOS-t (`11.3.0`).
- **Hátrányok, kockázatok és nem ellenőrzött külső rendszerek (`KG-13` / `KG-63` - `KG-67`):**
  - **Élő sandbox kulcsokkal még nem ellenőrzött:** a 2026-11-15-i spike idején nem álltak rendelkezésre Stripe/Barion/SimplePay sandbox kulcsok, így a valós fizetőoldal-redirect URL, a Stripe 3DS `requires_action` lefutása és az aláírt IPN/webhook `pending -> processing` átmenete nem futott le élőben. Ezek a **`KG-13`** (`KG-63`, `KG-64`, `KG-65`, `KG-67`) **kötelező első verifikációs kapui**.
  - A `wpxpert-payment-gateway-for-simplepay` (`0.2.1`) korai verziójú, SimplePay v2.1 API-ra épül (nincs benne Apple Pay, Google Pay, qvik, SZÉP-kártya vagy kétlépcsős fizetés), és szigorúan HTTPS return URL-t követel (lokálisan Cloudflare Tunnel szükséges).
  - A `kg-headless` `allowed_redirect_hosts` filtere és `wc_add_notice` továbbítása nélkül a Stripe és a SimplePay visszatérése headless módban nem működik (`KG-13` előfeltétel).
  - Ha később a SimplePay qvik, Apple Pay, Google Pay, SZÉP-kártya vagy kétlépcsős fizetés üzleti követelmény lesz, az `wpxpert-payment-gateway-for-simplepay` cseréje fizetős v3 pluginre (pl. Cone SimplePay) a `kg-stack` stack-változási folyamata szerint (**új ADR + `kg-stack` frissítés**) történhet.
- **Ticket-finomítás (`kg-ticket-refine`):** a `KG-13` és `KG-63` - `KG-66` jegyek (különösen a `KG-66` `order-pay` hivatkozása a Store API `checkout/{id}` + `order/{id}` helyett) az ADR-0017 elfogadása után külön `kg-ticket-refine` frissítést igényelnek (Jira-írás csak külön kérésre).
- Frissítve (ugyanebben a PR-ban): `.agents/skills/kg-stack/SKILL.md` (`Fizetés` sor és fejléc), `AGENTS.md` („Stack röviden”), `.agents/skills/kg-architecture/references/woo-integration.md`, `packages/woo-client/README.md`, `wordpress/plugins/kg-headless/README.md`, `docs/project-plan.md` („Kockázatok”).

## Mérlegelt alternatívák

| Alternatíva | Miért nem |
| --- | --- |
| Fizetős SimplePay v3 (pl. Cone, ~15 000 Ft/év/domain) induláskor | Zárt forrású és brandenként évente licencdíjas; qvik / Apple Pay / kétlépcsős SimplePay az induláshoz nem kritikus, Stripe/Barion mellett kiváltható |
| M2-ben csak Barion + Stripe, SimplePay későbbi körben | A magyar vásárlók számára a SimplePay kulcsmárka, és az ingyenes WPXpert plugin Store API + HPOS kompatibilisnek bizonyult |
| WordPress natív `order-pay` oldal megnyitása a headless kivételével | Két külön UI-réteg és arculat fenntartását jelentené; a Woo `11.3.0` Store API `order/{id}` + `checkout/{id}` tiszta Next.js-ben tartja a folyamatot |
