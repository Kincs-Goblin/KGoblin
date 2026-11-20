# ADR-0015: Billingo-bekötés módja - Trigger.dev issue-invoice task (API v3)

- Állapot: elfogadott
- Dátum: 2026-11-15 (frissítve: 2026-11-20)
- Döntéshozók: ricsmond12
- Jóváhagyás: `ricsmond12` választása a 2026-11-15-i „Kezdő ticket kiválasztása” munkamenet opciós kérdésére („Melyik Billingo-bekötési módot válasszuk (KG-33)?” -> „(Recommended) Trigger.dev issue-invoice task a Billingo API v3-mal (apps/jobs)”; a teljes kérdés, a 3 opció és a válasz a PR-leírásban, az összegzés rögzítve a 2026-11-15T21:34-i [KG-33](https://kincsgoblin.atlassian.net/browse/KG-33) Jira-kommentben); az ADR kibővített részleteinek végleges megerősítése a PR merge-hez adott „mehet”-tel (`kg-stack` 4-5.)
- Ticket: KG-33

## Kontextus

- A `kg-stack` „Számlázás bekötése” sora nyitott volt (Woo Billingo plugin vagy Trigger.dev task a Billingo API-val), és a `KG-16` (4. mérföldkő, számlázás) megvalósítása előtt le kell zárni.
- Az ADR-0001 már kiválasztotta a Billingót (NAV Online Számla) és a Trigger.dev-et (`apps/jobs`) az idempotens mellékhatások futtatására.
- A `kg-headless` plugin (`wordpress/plugins/kg-headless/includes/class-kg-checkout-fields.php`) már HPOS-kompatibilisen validálja és menti a Woo-rendelésre a céges számlaadatait (`_billing_is_company`, `_billing_company_name`, `_billing_tax_number`), míg a kupon-, szállításidíj- és egyéb díjtételek a WooCommerce natív rendeléssoraiból (`coupon_lines`, `shipping_lines`, `fee_lines`) érkeznek.

## Döntés

- A számlakiállítás **Trigger.dev `issue-invoice` háttérjobbal**, a **Billingo API v3** (`https://api.billingo.hu/v3`) közvetlen hívásával fog történni a `KG-16`-ban (`KG-80`) létrejövő `apps/jobs/src/adapters/billingo/` adapteren keresztül; WooCommerce Billingo-plugint nem telepítünk (az ütközések elkerülésére).
- **Idempotencia és bizonytalan eset (`KG-81`):** kettős garancia fogja védeni a számlakiállítást:
  1. Trigger.dev idempotencia-kulcs brand-előtaggal (`issue-invoice:<brand>:<orderId>`);
  2. Billingo API v3 `vendor_id` egyediségi kulcs (pl. `<brand>:<orderId>`), amely újrapróba vagy bizonytalan `POST /documents` válasz esetén előzetesen ellenőrizhető a `GET /documents/vendor/{vendor_id}` végponton.
  - A Billingo API v3 `vendor_id` egyedisége (a duplikált `vendor_id`-val indított `POST /documents` elutasítása) és a `GET /documents/vendor/{vendor_id}` válasz viselkedése külső API-feltételezés, amelyet a `KG-83` élő Billingo sandbox tesztjeiben ellenőrzünk.
  - Ha maga a `GET /documents/vendor/{vendor_id}` lekérdezés is hibás vagy bizonytalan marad, **nincs vak automatikus újralétrehozás**: a rendelés `invoice_uncertain` állapotba kerül, riasztás megy (`reportTaskFailure` / `KG-88` Sentry), és kézi ellenőrzés következik (a `jobs-and-suppliers.md` „Szabályok” szakaszával összhangban).
- **Adatátadás és bizonylat (`KG-16`, `KG-80`, `KG-81`, `KG-82`, `KG-83`):** a task a `packages/woo-client` szerveroldali REST v3 kliensével olvassa majd be a rendelést és a `kg-headless` HPOS-metamezőit (`_billing_is_company`, `_billing_company_name`, `_billing_tax_number`), a kedvezményeket a NAV-előírásoknak megfelelően negatív tételként adja át, és a keletkezett `billingo_document_id`-t + PDF/elérési linket visszaírja a Woo-rendelésbe (a `KG-17` `send-email` és a `KG-15` vásárlói fiók számára). Mivel a jelenlegi `packages/woo-client/src/rest/schemas.ts` `restOrderSchema` sémája még nem tartalmaz `billing`, `line_items`, `coupon_lines`, `shipping_lines`, `fee_lines` és adómezőket, a `KG-16`-ban (`KG-80`) bővítendő velük, és a `KG-83`-ban élő Docker-Woo ellen ellenőrizendő, hogy a REST v3 `meta_data` visszaadja az `_`-előtagú `_billing_*` kulcsokat.
- **Hibakezelés és újrapróba:** a biztosan meg nem történt hívások (kapcsolódási hiba) és a `vendor_id`-lekérdezéssel igazolt, még létre nem jött számlák Trigger.dev backofffal újrapróbálhatók lesznek; tartós hiba esetén a meglévő `apps/jobs/src/trigger/init.ts` `onFailure` hookja (`apps/jobs/src/adapters/telemetry.ts` `reportTaskFailure`) rögzíti PII-mentesen a hibakódot, és a `KG-88` Sentry-bekötéstől riaszt Sentryben. Az aszinkron PDF-generálás („Document PDF has not generated yet.”) késleltetett újrapróbálással kezelendő.
- **Sztornó:** kizárólag kézi művelettel történik a Billingo felületén (vagy később külön manuális admin/CLI parancsból a `POST /documents/{id}/cancel` végponton), automatikus vak sztornó nincs; a kézi sztornó és helyesbítő számla runbookja a `KG-82`-ben készül a `docs/runbooks/` alá.
- **Brandenkénti elkülönítés és költség:** a `KG-16`-ban a `packages/brand-config` sémája `billingo: { apiKeyEnv, blockId }` mezőkkel bővül (a nem titkos `blockId` és az env-változó neve, pl. `BILLINGO_GAMER_API_KEY`, a `woo.baseUrlEnv` mintájára), míg a titkos `X-API-KEY` értékek kizárólag a Trigger.dev környezeti változóiba kerülnek. A számlázási API-hoz szükséges Billingo-csomag (API és tömeges számlagenerálás kiegészítő) mindhárom megközelítésnél azonos költség; a *Woo Billingo Plus* emellett évi kb. 30 EUR licencdíjat jelent.

## Következmények

- **Előnyök:** kettős idempotencia (`issue-invoice:<brand>:<orderId>` + `vendor_id`), `kg-headless` céges mezők közvetlen kezelése PHP-bridge nélkül, központi Trigger.dev + Sentry láthatóság és `send-email` láncolás, valamint függetlenség a WP/Woo plugin-frissítésektől és azok regresszióitól.
- **Többletmunka (`KG-16` / `KG-80` - `KG-83`):** a `packages/woo-client` `restOrderSchema` bővítése és az `_billing_*` mezők élő Woo elleni ellenőrzése (`KG-80`, `KG-83`), a `packages/brand-config` `billingo` konfiguráció felvétele, saját Billingo API v3 adapter írása (`POST /partners`, `POST /documents`, `GET /documents/vendor/{vendor_id}`, `GET /documents/{id}/download` / publikus link), `docs/runbooks/` sztornó-runbook (`KG-82`), valamint Billingo sandbox tesztek magánszemély, cég, kupon és szállítási díj eseteire (`KG-83`, beleértve a duplikált `vendor_id` elutasításának élő ellenőrzését).
- Frissítve: `kg-stack` („Számlázás bekötése” sor), `AGENTS.md` („Stack röviden”), `docs/project-plan.md` („Nyitott döntések”), `.agents/skills/kg-architecture/references/jobs-and-suppliers.md` („Billingo” és tasktábla), `.agents/skills/kg-architecture/references/multi-brand.md` (`Brand-config` tábla és onboarding checklist).

## Összehasonlítás a 7 szempont szerint

| Szempont | Trigger.dev `issue-invoice` (API v3) | Billingo Official plugin (4.3.x) | Woo Billingo Plus (PRO) |
| --- | --- | --- | --- |
| Idempotencia | Kettős: `issue-invoice:<brand>:<orderId>` + `vendor_id` ellenőrzés (`invoice_uncertain` ággal) | WP/Woo plugin belső meta alapú, külső `vendor_id` ellenőrzés és központi kulcs nélkül | WP/Woo plugin belső meta alapú, központi job-kulcs nélkül |
| Céges adatok (`kg-headless`) | REST v3 `meta_data`-ból közvetlenül (`_billing_is_company`, `_billing_company_name`, `_billing_tax_number`) | Külön egyedi PHP-hook kell a pluginba | Külön PHP-filterekkel beköthető |
| Hibakezelés és újrapróba | Központi Trigger.dev backoff, `onFailure` (`reportTaskFailure` → `KG-88` Sentry), késleltetett PDF-újrapróba | Woo Action Scheduler / WP admin napló, Trigger.dev/Sentry láthatóságon kívül | Woo Action Scheduler / WP admin napló, Trigger.dev/Sentry láthatóságon kívül |
| Sztornó | Kézi a Billingo felületén (+ `KG-82` runbook, később opcionális kézi `POST /documents/{id}/cancel`) | Manuális vagy rendelés-státusz alapú plugin-automatizmus (kockázat) | Manuális vagy rendelés-státusz alapú plugin-automatizmus |
| Láthatóság | Trigger.dev dashboard + strukturált log + Woo rendelés-meta (`billingo_document_id`, link) | Csak WP admin és Woo rendelés-meta | Csak WP admin és Woo rendelés-meta |
| Költség | Billingo API-csomag (azonos alapdíj), 0 EUR plugin-licenc | Billingo API-csomag, 0 EUR plugin-licenc | Billingo API-csomag + évi kb. 30 EUR plugin-licenc |
| Brandenkénti Billingo-fiók | `brand-config` `billingo.blockId` + `apiKeyEnv` + Trigger.dev env brandenként | Külön WP-admin beállítás minden Woo-példányban | Külön WP-admin beállítás és licenc minden Woo-példányban |

## Mérlegelt alternatívák

| Alternatíva | Miért nem |
| --- | --- |
| *Billingo Official for WooCommerce* plugin (4.3.x) | A `kg-headless` egyedi céges mezőihez külön PHP-hook kellene, kiesne a Trigger.dev + Sentry központi pipeline-ból és a `KG-17` Resend email-láncból, valamint kitett a WP/Woo plugin-frissítési hibáknak (4.0 ÁFA/szállítási bugok, 4.3.2-ig jogosultságkiterjesztési CVE-2025-49950) |
| *Woo Billingo Plus* (PRO) | Külön PHP filterekkel beköthető lenne a `kg-headless`, de évi kb. 30 EUR plusz díjas külső plugin, és ugyanúgy a WP-n belül futna a központi Trigger.dev háttérjobok és egységes idempotencia-modell helyett |
