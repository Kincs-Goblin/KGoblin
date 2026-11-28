# ADR-0018: Kosár-BFF rate limit - Cloudflare Workers Rate Limiting binding

- Állapot: elfogadott (`SMark2256` választása opciós kérdésben, 2026-11-28; a kérdés és a válasz szövege a KG-127 PR-jában)
- Dátum: 2026-11-28
- Döntéshozók: SMark2256
- Jóváhagyás: SMark2256, 2026-11-28, opciós kérdés a KG-127 agent-sessionjében („Workers Rate Limiting binding (Recommended)”); a szöveg a PR-leírásban
- Ticket: KG-127

## Kontextus

- A kosár-BFF (`apps/web/src/shared/api/cart-bff.ts`, KG-12) rate limitere egy izolátumonkénti memóriabeli
  `Map` volt. Cloudflare Workersen (ADR-0009) sok, rövid életű izolátum szolgálja ki a kéréseket, ezért ez a
  limiter gyakorlatilag nem korlátoz: a kuponkód-próbálgatás és a leendő checkout (KG-13) védtelen.
- A 2026-11-24-i council-review ezt magas kockázatnak sorolta az M2 (kosár és checkout) előtt.
- A Cloudflare a stack része (ADR-0008, ADR-0009), de a Workers Rate Limiting binding új képesség: a
  `wrangler.jsonc` `ratelimits` mezőjében deklarált, kódból hívható számláló.

## Döntés

- A kosár-BFF minden Woo-t érő kérése (mutáció és cookie-s `GET /api/cart`) a `CART_RATE_LIMITER` Workers
  Rate Limiting bindingon megy át, `<brandId>:<cf-connecting-ip>` kulccsal, 60 kérés / 60 másodperc
  ablakkal (`apps/web/wrangler.jsonc`, `simple: { limit: 60, period: 60 }`, `namespace_id: "1001"`).
- A bindingot a kód a `getCloudflareContext()` (`@opennextjs/cloudflare`) környezetéből olvassa. Ahol nincs
  Cloudflare-kontextus (`next dev`, `next start` e2e, Vitest), a memóriabeli csúszóablakos limiter marad
  tartaléknak; Workersen a binding mindig deklarált (egy teszt ellenőrzi a `wrangler.jsonc`-t).
- Élesben a kulcs csak a Cloudflare által beállított `cf-connecting-ip` lehet; a hamisítható
  `x-forwarded-for` csak `NEXT_PUBLIC_APP_ENV=local` mellett. IP nélkül a kérések egy közös `unknown`
  vödörbe esnek (fail-closed).
- Túllépésnél `429 CART.RATE_LIMITED`, `Retry-After: 60` (a binding nem adja meg a hátralévő időt, az ablak
  hossza felső becslés).
- **Fail-open a limiter hibájára:** ha Workersen hiányzik a binding, vagy a `limit()` kivételt dob, a BFF
  naplóz (`console.error`, kliens-IP nélkül), és a memóriabeli tartalék dönt. Egy limiter-kiesés így nem
  állítja le a kosarat; az ár, a készlet és a kupon érvényessége ettől függetlenül a Woo-ban ellenőrzött.

## Következmények

- **Előnyök:** a limit izolátumoktól független, kódból tesztelhető (injektálható limiter), külön szolgáltatás
  vagy tárhely nélkül; a checkout (KG-13) ugyanezt a limitert használhatja.
- **Korlátok:**
  - a binding számlálói a Cloudflare dokumentációja szerint helyszínenként (location) élnek és nem
    pontosak: elosztott támadásra a WAF-szabály (külön kérésre, külső rendszer) a kiegészítő védelem;
  - a `namespace_id` a Cloudflare-fiókon belül egyedi; a production Worker (külön ticket) saját vagy közös
    namespace-ét a deploynál el kell dönteni;
  - a valódi elosztott viselkedés csak a demó Workeren ellenőrizhető, helyben és a CI-ban a memóriabeli
    tartalék fut;
  - `NEXT_PUBLIC_APP_ENV=local` nélkül és `cf-connecting-ip` nélkül (pl. Playwright `demo` env-vel, Workersen
    kívül) minden kérés egy közös `unknown` vödörbe esik, ezért 60 kérés/perc fölött 429-et kap; az e2e
    ezért `local` env-vel fut.
- Frissítve: `kg-stack` („Rate limit” sor), `AGENTS.md` („Stack röviden”).

## Mérlegelt alternatívák

| Alternatíva | Miért nem |
| ----------- | --------- |
| Cloudflare WAF Rate Limiting szabály | Dashboardon beállított külső konfiguráció: a kódban nem tesztelhető és nem verziózott; kiegészítő védelemként később bevezethető (külön kérésre) |
| Durable Object számláló | Pontos, globális limit, de új Durable Object osztály, migráció és több kód; ennyi forgalomnál túlméretezett |
| A memóriabeli `Map` megtartása | Workersen az izolátumok miatt érdemben nem korlátoz (a council-review magas findingja) |
