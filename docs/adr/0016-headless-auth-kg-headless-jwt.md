# ADR-0016: Headless vásárlói auth - saját JWT végpontok a `kg-headless` pluginban

- Állapot: elfogadott
- Dátum: 2026-11-15 (frissítve: 2026-11-20)
- Döntéshozók: ricsmond12
- Jóváhagyás: `ricsmond12` választása a 2026-11-15-i „Kezdő ticket kiválasztása” munkamenet opciós kérdésére („Melyik WordPress headless customer auth megoldást rögzítsük az ADR-0016-ban (KG-31)?” -> „(Recommended) Saját JWT auth végpontok a kg-headless pluginban (15p Access JWT + rotált Refresh Token + jti tiltás + Store API kosárösszevonás)”; a kérdés és mindhárom opció a PR-leírásban szerepel, a döntés összegzése a 2026-11-15T21:34:50+0100-as [KG-31](https://kincsgoblin.atlassian.net/browse/KG-31) Jira-kommentben is rögzítve); az ADR 2026-11-20-i pontosításainak megerősítése a PR merge-hez adott „mehet”-tel (`kg-stack` 4-5.)
- Ticket: KG-31
- Kapcsolódik: ADR-0001 (Kezdő stack)

## Kontextus

- A `kg-stack` „Auth plugin” sora nyitott volt, és a `KG-15` (4. mérföldkő: vásárlói fiók, belépés, regisztráció, jelszó-visszaállítás, rendeléseim) megkezdése előtt dönteni kell róla.
- Az architektúra BFF-alapú (`apps/web`): a böngésző nem hívja közvetlenül a WordPresst; a `Cart-Token` már brandenként külön `httpOnly; Secure; SameSite=Lax` cookie-ban tárolódik, és a tervezett vásárlói auth tokenek is kizárólag a Next.js szerveroldali BFF cookie-jaiban fognak élni (`KG-15`).
- A lokális Docker-környezetben (`WordPress 7.1.4 + WooCommerce 11.3.0 + Redis 7`) már fut a saját `kg-headless` plugin (`wordpress/plugins/kg-headless/`, jelenleg `0.1.0`), és a WooCommerce `Automattic\WooCommerce\StoreApi\SessionHandler` (`init_session_from_token()`), `StoreApi\Utilities\CartTokenUtils` és `StoreApi\Utilities\JsonWebToken` forrása, valamint a `KG-31` élő HTTP-mérései igazolták, hogy külső vendég `Cart-Token` fejléc esetén a Store API a vendég (`t_...`) kosarat olvassa bejelentkezett `Bearer` fejléc mellett is, azaz nem egyesíti automatikusan a vendégkosarat a customer kosarával.

## Döntés

- **Külső WP JWT/auth plugint nem telepítünk;** a vásárlói hitelesítést a meglévő **`kg-headless` plugin** (`wordpress/plugins/kg-headless/`) új `/wp-json/kg/v1/auth/*` végpontjai fogják megvalósítani a **`KG-15`** (`KG-75` - `KG-79`) implementációjában, az alábbi tervezett szerződéssel:
  - **Kriptográfia és nulla külső PHP-függőség:** a WooCommerce magban szállított `Automattic\WooCommerce\StoreApi\Utilities\JsonWebToken` (`HS256`) használata brandenként külön `KG_JWT_SECRET` környezeti változóval (a `KG-15`-ben bevezetve; titokkezelés mint a többi backend titoknál).
  - **Kettős token-modell és élettartam (`KG-15` / `KG-75`):**
    - **Access JWT:** rövid élettartam (**15 perc**), `iss` (brand backend URL), `sub` (user ID), `jti` (128 bites véletlen azonosító) és `exp` mezőkkel. Csak `REST_REQUEST` + `Authorization: Bearer <token>` kérésnél futó `determine_current_user` hookon érvényesül, és ellenőrzi a `jti` visszavonási tiltólistát.
    - **Refresh Token:** **30 napos** élettartam, kriptográfiailag erős véletlen token (`<userId>.<random>`), amelynek szerveroldalon csak az **SHA-256 hash**-e tárolódik lejárattal és aktív session-korláttal. Minden frissítés **kötelező rotációval** fog járni (a felhasznált refresh token törlődik; régi token újrajátszása `401`-et ad, és érvényteleníti a hozzá tartozó sessiont).
  - **Tervezett végpontok (`/wp-json/kg/v1/auth/*`, megvalósítás: `KG-15`):**
    - `POST /login`: `wp_authenticate()` alapú hitelesítés; opcionálisan fogadja a `guest_cart_token`-t, és egy szerveroldali körben egyesíti a vendégkosár tételeit a customer Woo-sessionjébe (`session_key = (string) $user->ID`), majd visszaadja az Access JWT-t, a Refresh Tokent és a customer `Cart-Token`-t (`CartTokenUtils::get_cart_token()`).
    - `POST /register`: kizárólag `customer` szerepkörrel hoz létre fiókot (szerepkör-paraméter tiltva), és opcionálisan szintén egyesíti a vendégkosarat (`KG-76`).
    - `POST /refresh`: rotált tokenpár kiadása (`KG-75`).
    - `POST /logout`: refresh token törlése + az aktuális Access JWT `jti`-jének felvétele az élesben kötelező Redis tiltólistára a hátralévő `exp - now` élettartamra (`KG-75`).
    - `POST /lost-password` és `POST /reset-password` (összhangban a `KG-76`, `KG-17` és `kg-stack` `Email` sorával): a `POST /lost-password` végpont **nem nyilvánosan, hanem kizárólag a Next.js szerveroldali BFF-ből hívható** (szerver-szerver megosztott titokkal / HMAC-aláírással vagy REST v3 szerverhitelesítéssel védve, és Cloudflare WAF-fal elzárva a közvetlen böngészőeléréstől). A WordPress mag (`get_password_reset_key`) állítja elő az egyszer használatos, lejáró kulcsot, és csak a BFF-nek adja vissza; a BFF a Trigger.dev `send-email` (`KG-17`, Resend + React Email) jobot indítja el a storefront `/elfelejtett-jelszo` linkkel (nem a WP alapértelmezett levelével). **A nyers reset-kulcs soha nem kerül a kliens HTTP-válaszába** (a BFF egységes `200`-as választ ad, hogy ne árulja el, létezik-e a fiók). A `lostpassword_url` -> `/elfelejtett-jelszo` filter már megvan a `wordpress/plugins/kg-headless/kg-headless.php` `142-152.` sorában; a `woocommerce_get_endpoint_url` `lost-password` szűrése és a `check_password_reset_key` + `reset_password` alapú jelszócsere-végpontok a `KG-15`-ben készülnek el. Sikeres jelszócsere törli a felhasználó összes aktív refresh tokenjét.
  - **BFF és biztonság (`KG-15`, `KG-75`, `KG-78`, `KG-79`):** a `apps/web` szerveroldali BFF auth moduljai brand-előtagos `httpOnly; Secure; SameSite=Lax` cookie-ban fogják tárolni az access/refresh tokeneket, lejárt access esetén átlátszóan rotálnak, a belépésen/regisztráción/elfelejtett jelszón rate limitet és brute-force védelmet alkalmaznak, a fiókmódosításokat CSRF-védelemmel látják el, és PII-t vagy tokent nem logolnak.

## A KG-31 spike eredménye (lokális Docker Woo 11.3.0 / WP 7.1.4)

A próbakód nem került merge-re (a `kg_wp_gamer` konténeren futott 2026-11-15-én, és utána letakarításra került). A lokális HTTP-próbák a `http://127.0.0.1:8080` végponton futottak (`wp plugin install` a WP-CLI konténerben; `POST /wp-json/kg/v1/auth/{login,refresh,logout,lost-password,reset-password}`, `GET /wp-json/wp/v2/users/me` és `GET /wp-json/wc/store/v1/cart`), a Store API vendég `Cart-Token` felülírását pedig a Woo `StoreApi\SessionHandler::init_session_from_token()` forráskódja is igazolja.

| Jelölt | Kipróbálás és állapot | Biztonság és karbantartás (2026-11-15-i állapot) | Működés az 5 követelményre |
| --- | --- | --- | --- |
| **Saját `kg-headless` JWT spike** | Élő HTTP-próba zöld | **0 külső plugin-kitettség**, szűk felület csak `customer` szerepkörre | Login (`900 s`), rotált refresh (`401` replay), logout (`jti` tiltás -> `/users/me` `401`), jelszó-visszaállítás, vendégkosár-összevonás (`merged: 1`) mind zöld |
| `jwt-authentication-for-wp-rest-api` (1.5.0) | Élő HTTP-próba zöld (csak alap) | Aktív (2026-02), a spike idején nem ismert CVE | Login + validate `200` (fix 7 napos token), de **nincs refresh (`404`), nincs logout/visszavonás, nincs jelszó-visszaállítás**, és a vendég `Cart-Token` felülírja a customer kosarát |
| `simple-jwt-login` | WP-CLI telepítés elutasítva | **`simple-jwt-login: closed` a WordPress.org-on (2026-11-15)**; korábbi 2026-os CVE-előzmények ([CVE-2026-19714](https://nvd.nist.gov/vuln/detail/CVE-2026-19714) CVSS 9.1 `< 3.6.8`, [CVE-2026-14262](https://nvd.nist.gov/vuln/detail/CVE-2026-14262) `<= 3.6.6`, [CVE-2026-39793](https://nvd.nist.gov/vuln/detail/CVE-2026-39793)) | A `closed` státusz miatt nem telepíthető biztonságosan |

## Következmények

- **Előnyök:** nincs külső auth plugin CVE- és frissítési kockázat; azonnali visszavonhatóság (`jti` Redis tiltás + refresh rotáció); atomi vendégkosár-összevonás belépéskor; nulla új PHP Composer-csomag.
- **Hátrányok és kockázatok (`KG-15` / `KG-75` - `KG-79`):**
  - Saját auth kód biztonsági és karbantartási terhe miatt a `KG-15` PR-okon kötelezőek a `KG-79` biztonsági és brand-elkülönítési tesztek (cross-brand cookie elutasítás, rate limit, lejárt/rotált token) és a `kg-council` review.
  - Brandenként külön `KG_JWT_SECRET` kulcskezelés és biztonságos rotáció szükséges (VPS / Docker Compose env titkok).
  - **Élesben a Redis object cache kötelező a `jti` tiltólistához:** perzisztens Redis nélkül a `wp_cache` csak kérésenként él és a tiltólista elveszne, a DB-alapú transient (`wp_options`) pedig nem skálázódik (a Redis a `kg-stack`-ben és a `wordpress/docker/setup.ps1`/`setup.sh` telepítőben már megkövetelt).
  - A WooCommerce belső `StoreApi\Utilities\JsonWebToken`, `StoreApi\SessionHandler` és `StoreApi\Utilities\CartTokenUtils` osztályaira épül, ezért WooCommerce major frissítés előtt PHP egység- és integrációs regressziós teszt szükséges.
- **Többletmunka és követő jegyek (`KG-15`, `KG-75` - `KG-79`, `KG-17`):**
  - A `kg-headless` pluginba be kell építeni a végleges `/wp-json/kg/v1/auth/*` végpontokat (PHP unit/integrációs tesztekkel, rate-limit védelemmel, `woocommerce_get_endpoint_url` `lost-password` szűrővel, valamint a `POST /lost-password` szerveroldali BFF-hitelesítésével), a `packages/woo-client`-be az auth klienst, az `apps/web` BFF-be a token- és cookie-rotációt, valamint összekötni a `KG-17` `send-email` taskjával és Resend jelszó-visszaállító sablonjával.
  - **Ticket-finomítás (`kg-ticket-refine`):** a `KG-15` és `KG-75` jegyek szövege jelenleg még „választott auth plugin”-ra hivatkozik, a `KG-76` és a `KG-17` leírását pedig érdemes kiegészíteni a BFF-ből hívott `/lost-password` -> Trigger.dev `send-email` reset-kulcs átadással (`kg-ticket-refine` külön javaslat, Jira-írás külön kérésre).
- Frissítve (ugyanebben a PR-ban): `.agents/skills/kg-stack/SKILL.md` („Auth plugin” sor és fejléc), `AGENTS.md` („Stack röviden”), `docs/project-plan.md` („Nyitott döntések”), `.agents/skills/kg-architecture/references/woo-integration.md` (API-táblázat, kosárösszevonás és `kg-headless` tervezett auth szekció).

## Mérlegelt alternatívák

| Alternatíva | Miért nem |
| --- | --- |
| Ingyenes `jwt-authentication-for-wp-rest-api` | Fix 7 napos token visszavonás és refresh nélkül; nincs jelszó-visszaállítási REST végpont, és így is saját WP/BFF kódot kellene írni mellé |
| `simple-jwt-login` | A 2026-11-15-i spike állapotában `closed` státuszú volt a WordPress.org-on, több 2026-os CVE-előzménnyel ([CVE-2026-19714](https://nvd.nist.gov/vuln/detail/CVE-2026-19714), [CVE-2026-14262](https://nvd.nist.gov/vuln/detail/CVE-2026-14262), [CVE-2026-39793](https://nvd.nist.gov/vuln/detail/CVE-2026-39793)) |
| Fizetős PRO auth plugin (pl. `JWT Auth PRO`, `miniOrange`) | Külső licenc- és frissítési függőség brandenként, továbbra is extra kosár-összevonó ragasztókóddal (`miniOrange`-nál 2026-os [CVE-2026-89027](https://nvd.nist.gov/vuln/detail/CVE-2026-89027) előzmény is volt `< 4.8.0` alatt) |
| `CoCart` + `CoCart JWT` | Lecserélné a Woo Store API-t saját kosár-API-ra (ütközik az ADR-0001-gyel), és 2026-ban súlyos CSRF CVE-előzménye volt ([CVE-2026-93549](https://nvd.nist.gov/vuln/detail/CVE-2026-93549), `< 4.9.7`) |
