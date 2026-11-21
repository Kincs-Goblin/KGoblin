# ADR-0014: Demo és staging Woo stratégia - brandenként külön demo-Woo

- Állapot: elfogadott
- Dátum: 2026-11-15 (frissítve: 2026-11-20)
- Döntéshozók: ricsmond12
- Jóváhagyás: `ricsmond12` választása a 2026-11-15-i „Kezdő ticket kiválasztása” munkamenet opciós kérdésére („(Recommended) KG-30: Brandenként külön demo-Woo konténer (demo-api.<brand>) + seed/snapshot reset”; mindhárom bemutatott opció és a válasz a PR-leírásban, az összegzés rögzítve a 2026-11-15-i [KG-30](https://kincsgoblin.atlassian.net/browse/KG-30) Jira-kommentben); az ADR részleteinek (Access-hatókör, reset-menet, PR-preview) végleges megerősítése a PR merge-hez adott „mehet”-tel (`kg-stack` 4-5.)
- Ticket: KG-30

## Kontextus

- A `kg-stack` „Demo/staging Woo” sora nyitott volt (brandenként külön demo-Woo vagy közös staging).
- Az ADR-0008 alapján az éles WP + Woo brandenként külön Docker Compose szolgáltatásként fog futni VPS-en, Cloudflare Tunnel mögött (`api.<domain>`).
- Az ADR-0009 (és a `KG-119`) létrehozta a `demo` ágról buildelő Cloudflare Workert (`apps/web/wrangler.jsonc`, `https://kincsgoblin.devdemos.workers.dev`), amely jelenleg `KG_STORE_FIXTURES=1`-gyel fut. Amint az ügyfélteszt valódi katalógussal, kosárral, checkouttal, sandbox fizetéssel és webhookokkal indul, a `demo` környezetnek (`KG_STORE_FIXTURES=0`) stabil, éles adattól teljesen elkülönített Woo-háttér kell.
- Az ADR-0009 óta a frontend Cloudflare Workersen fut (Vercel helyett); külön PR-preview deploy jelenleg nincs, amíg a preview brand-host stratégia el nem készül (külön ADR-0009 follow-up ticket).

## Döntés

- A `demo` környezethez **brandenként külön demo-Woo Docker konténer** fog futni (a gyökér `docker-compose.yml` és az ADR-0008 VPS + Docker Compose mintája alapján), éles adatbázistól, éles kulcsoktól és éles rendelésektől teljesen elszigetelten (külön demo adatbázis-példánnyal, nem közös éles DB-szerveren), `demo-api.<domain>` alatt, Cloudflare Tunnel és WAF mögött.
- **Hozzáférés és Cloudflare Access:** a `demo-api.<domain>` admin felületeit (`/wp-admin`, `/wp-login.php`) Cloudflare Access védi majd, míg a Store API, REST v3 és feltöltött médiák elérése WAF-szabályokkal lesz korlátozva - vagy ha a teljes host Access mögé kerül, a beüzemelési ticketben `CF-Access-Client-Id` / `CF-Access-Client-Secret` service-token támogatással bővítjük a `packages/woo-client`-et (jelenleg nincs ilyen fejléc a kliensben) és tisztázzuk a Cloudflare `IMAGES` binding képletöltését.
- A demo-Woo minden külső integrációt kizárólag sandbox vagy fake módban fog használni a bevezetésüktől kezdve: Stripe/Barion/SimplePay sandbox (`KG-13` fizetés), Billingo sandbox (`KG-16` számlázás), fake beszállítói adapter (`KG-14` dropshipping), valamint `noindex` (`NEXT_PUBLIC_APP_ENV=demo`) és zárt WP admin. Éles adatbázist és valódi vásárlói PII-adatot soha nem klónozunk demóra.
- **Demo reset menete (`kg-release`):**
  - **Elsődleges tiszta visszaállítás:** ügyfélteszt vagy kiadási ciklus előtt a demo-Woo tiszta SQL-snapshot visszaállításával vagy üres adatbázisra futtatott `wp core install` + `wordpress/seed/seed-brand.php` lépéssel állítható vissza (ez eltávolítja a tesztrendeléseket, tesztvásárlókat és kuponhasználatokat).
  - **Katalógus-frissítés (`seed-brand.php`):** a meglévő `wordpress/seed/seed-brand.php` idempotens upsert szkript (rendelést és vásárlót nem töröl), ezért önmagában nem teljes reset, hanem a katalógus és a beállítások helyreállítására szolgál. Futtatásakor kötelező megadni a `KG_FRONTEND_URL` (demo Worker URL) és `KG_WEBHOOK_SECRET` (demo webhook titok) környezeti változókat, a demo-Woo konténerben pedig a `WP_ENVIRONMENT_TYPE=staging` beállítást. A seed fail-closed: ha nem teljesen lokális a környezet (lokális frontend és `WP_ENVIRONMENT_TYPE=local`), saját, nem `kg_local_` előtagú `KG_WEBHOOK_SECRET` nélkül hibával leáll (a setup-szkriptek által átadott alapértelmezéssel is), és a frontend a `kg_local_` titkot nem lokális `NEXT_PUBLIC_APP_ENV` mellett elutasítja; `production` WP-környezetben egyáltalán nem fut; a `docker-compose.yml` a `WP_ENVIRONMENT_TYPE`-ot alapérték nélkül, kötelezőként kéri (lokálisan a setup és a `.env.example` adja a `local`-t), így egy VPS-compose sem indul csendben `local` módban; a lokális alapértelmezés `http://<brand>.localhost:3000`. *(2026-11-21 előtt a seed csendben `http://localhost:3000`-ra és a `kg_local_<brand>_webhook_secret` titokra esett vissza.)*
  - **Index és cache:** a visszaállítást követően a Meilisearch demo-index újraindexelése (`KG-10` / `ADR-0012` után) és a demo Worker cache-ének frissítése szükséges. Mivel a nyers SQL-snapshot visszaállítás nem süt el Woo webhookot, az `/api/webhooks/woo/[brand]` végpont pedig csak aláírt Woo POST webhookot fogad (kézi revalidáló végpont nincs), a cache-frissítés a katalógus újraseedelésével/mentésével (aláírt Woo webhookokkal) vagy külön demo Worker KV/D1 cache-ürítéssel történik majd (a pontos parancs a beüzemelési ticketben készül el).
- **PR-previewk:** a lokális fejlesztés és a CI továbbra is a lokális Docker-Woo-val vagy `KG_STORE_FIXTURES=1`-gyel fut; későbbi Workers PR-previewk esetén (az ADR-0009 follow-up ticketben) azok alapból `KG_STORE_FIXTURES=1`-gyel vagy a demo-Woo-ra mutatva működnek majd.

## Következmények

- **Előnyök:** valódi multi-brand elkülönítés demón is (brandenként külön kosár, készlet, kupon, webhook); egységes Docker-architektúra lokálisan, demón és élesben; az éles adat és pénzügyi folyamatok érintetlenek maradnak; nincs extra SaaS-díj, ha a választott VPS-en vagy külön kis staging VPS-en elférnek a konténerek.
- **Hátrányok és kockázatok:** brandenként plusz WP/Woo konténer és külön demo DB-példány növeli a RAM/CPU-igényt (a végső költség a nyitott VPS-szolgáltató döntéstől függ); karban kell tartani a tiszta SQL-snapshotot és a seedet; a demo és az éles konfiguráció (sandbox kulcsok, Access/WAF szabályok) eltérése külön figyelmet és üzemeltetési munkát igényel.
- **Üzemeltetés és későbbi feladatok:** a `demo-api.<domain>` konténerek és külön demo DB-példány, a Cloudflare Access hatókörének eldöntése (admin-only vs service-token a `woo-client`-ben), a demo Worker `WOO_<BRAND>_URL` (amelyet az `apps/web/next.config.ts` build időben automatikusan felvesz az `images.remotePatterns` listába; `KG_MEDIA_REMOTE_HOSTS` csak külön extra média-host esetén kell) és sandbox kulcsok beállítása (`KG_STORE_FIXTURES=0`), valamint a reset és cache-ürítési parancs külön feladatban készül el az M1-M2 ügyfélteszt előtt *(még nincs Jira-ticket; javasolt cím: „Demo-Woo konténerek (`demo-api.<domain>`), külön demo DB, Cloudflare Access/WAF és demo reset + cache-ürítés beüzemelése az M1-M2 ügyfélteszthez”)*. A PR-previewk külön ADR-0009 follow-up ticketben kapnak brand-host stratégiát.
- Frissítve: `kg-stack` („Demo/staging Woo” sor), `kg-release` („4. Demo PR-ok”), `AGENTS.md` („Stack röviden”), `docs/project-plan.md` („Nyitott döntések”), `docs/process/infrastructure.md` (demo Worker Woo-háttere).

## Mérlegelt alternatívák

| Alternatíva | Miért nem |
| --- | --- |
| Közös staging Woo több brandnek | Kevesebb konténer és memória, de sérti a brandenként külön Woo elvet (ADR-0001), keverednek a termékek, rendelések, kuponok és webhookok, így a multi-brand elkülönítés demón nem tesztelhető |
| Csak lokális Docker-Woo + `KG_STORE_FIXTURES=1` a demón | Nulla távoli üzemeltetés, de a távoli `demo` Workerben nem próbálható ki valódi kosár, checkout, sandbox fizetés vagy webhook, így az ügyfélteszt csak fejlesztői gépen futhatna |
