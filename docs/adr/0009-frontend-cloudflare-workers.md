# ADR-0009: Frontend hosting - Cloudflare Workers (OpenNext)

- Állapot: elfogadott (2026-11-14, a KG-118 spike után)
- Dátum: 2026-11-13
- Döntéshozók: SMark2256, ricsmond12
- Ticket: KG-29 (döntés), KG-118 (spike), KG-119 (migráció)
- Felváltja: az ADR-0001 „Frontend hosting” sorát (Vercel)

## Kontextus

- Az ADR-0001 szerint az `apps/web` a Vercelen futott (preview deploy PR-onként, production a `main`-ről). A
  KG-6 ehhez elkészítette az `apps/web/vercel.json`-t és a `VERCEL_ENV`-re is figyelő `noindex` logikát.
- Az ADR-0008 óta a backend előtt Cloudflare áll (DNS, WAF, Tunnel), és a képekhez is az R2 a jelölt. Ha a
  frontend is ott fut, egy szolgáltatónál van a DNS, a domainek, a frontend és a backend-védelem.
- A Vercel Hobby csomagja nem kereskedelmi célra szól; egy webshophoz Pro kell, fejlesztőnként havidíjjal.
  A Cloudflare Workers fizetős csomagja fiókszintű, kis fix díjjal.
- A Next.js a Cloudflare-en nem natívan, hanem az OpenNext adapterrel (`@opennextjs/cloudflare`) fut
  Workersen. A nyitott kérdéseket (`proxy.ts`, ISR és `revalidateTag`, `next/image`, méret, preview) a KG-118
  spike vizsgálta.

## Döntés

- Az `apps/web` a Cloudflare Workersen fut az OpenNext adapterrel; a Vercel-konfiguráció megszűnt (KG-119).
- Konfiguráció: `apps/web/wrangler.jsonc` és `apps/web/open-next.config.ts`.
  - ISR és data cache: KV (`NEXT_INC_CACHE_KV`); az R2 most nincs bekapcsolva, később átállhatunk rá.
  - Tag cache a `revalidateTag`-hez: D1 (`NEXT_TAG_CACHE_D1`); revalidálási sor: Durable Object.
  - Képek: a Cloudflare Images `IMAGES` bindingja a `next/image` alatt.
- Build és deploy: Workers Builds a GitHub-repóról (`pnpm --filter @kg/web build:cf`, majd `deploy:cf`).
- Környezetek:
  - **demo:** a `kincsgoblin` Worker a `demo` ágról, `NEXT_PUBLIC_APP_ENV=demo` (noindex), egyelőre a
    `kincsgoblin.devdemos.workers.dev` hoston és a személyes Cloudflare-fiókon;
  - **production:** a `main`-ről, saját domainnel és a KGoblin-fiókon - külön ticket, a brand fődomainjével
    együtt;
  - **PR-preview:** most nincs. A Workers Builds preview-hostjait a `proxy.ts` nem ismeri (fail-closed 404),
    ehhez brand-host stratégia kell (külön ticket).
- A `noindex` csak a `NEXT_PUBLIC_APP_ENV`-en múlik (`preview` vagy `demo`); a `NEXT_PUBLIC_*` és a
  `KG_STORE_FIXTURES` build időben is kell, ezért a Workers Builds változói között is szerepelnek.

## A KG-118 spike eredménye

A spike a `spike/KG-118` ágon futott (nem ment merge-re), Workers Buildsszel, fixture-ös katalógussal.

| Kérdés | Eredmény |
|---|---|
| Build és deploy (Node 26, pnpm 12, monorepo) | sikeres, kb. 2 perc |
| Worker-méret, indulás | 7,4 MB, tömörítve 1,59 MB (korlát tömörítve: ingyenes csomagon 3 MB, fizetősön 10 MB); startup 27 ms; TTFB 0,14-0,2 s (egyszer 1,07 s) |
| `proxy.ts` brandválasztás | a `/` a gamer brandet adja; ismeretlen hostot élesben nem lehetett próbálni (a fail-closed 404-et unit-teszt fedi) |
| Fixture-katalógus | főoldal, `/termekek`, termékoldal 200; ismeretlen slug 404 |
| ISR | `x-nextjs-cache: HIT`, `s-maxage` + `stale-while-revalidate` |
| Data cache és tag-invalidálás | az `unstable_cache` értéke KV-ben marad; a D1-ben rögzített tag-revalidálás után új érték renderelődik. Magát a `revalidateTag()`-et hívó végpontot csak a 401-ig próbáltuk |
| `next/image` | 139 KB PNG → 258 bájtos WebP az `IMAGES` bindinggal |
| `noindex` | `X-Robots-Tag: noindex, nofollow` |
| PR-preview | nincs igazolva (lásd Döntés) |

## Következmények

- Egy szolgáltatónál van a DNS, a WAF, a frontend és a backend-védelem (ADR-0008); a havidíj fiókszintű.
- Kockázatok:
  - az OpenNext a Next 16 `proxy.ts`-t (Node middleware) **kísérletként** támogatja; a brandválasztás
    ezen múlik. Adapterfrissítés előtt a demón kell próbálni; vészmegoldás az edge runtime-os
    `middleware.ts`;
  - a Cloudflare új Next-appokhoz már a `vinext`-et ajánlja; az OpenNext karbantartott, de a hosszú távú
    irányt figyelni kell (értékelés: külön ticket, ha szükséges);
  - az OpenNext build Windowson symlinkek miatt Developer Mode vagy WSL nélkül nem fut; a napi fejlesztés
    (`next dev`) nem érintett, a Workers-build a Workers Buildsben fut.
- Nyitott follow-upok: production Worker saját domainnel a KGoblin-fiókon; PR-preview brand-hostokkal;
  a demo erőforrásainak (KV, D1) átnevezése vagy újralétrehozása a KGoblin-fiókon.
- Frissítve (KG-119): ADR-0001 („Frontend hosting” felváltva), `kg-stack`, `AGENTS.md`,
  `docs/project-plan.md`, `docs/process/infrastructure.md`, `docs/process/onboarding.md`, `kg-release`,
  `kg-dev-practices`, `kg-babysit-pr`, `kg-architecture/references/multi-brand.md`, `apps/web/README.md`, a
  PR-sablon és a `turbo.json`.

## Mérlegelt alternatívák

| Alternatíva | Miért nem |
| ----------- | --------- |
| Marad a Vercel | Natív Next-támogatás, de két szolgáltató, és a Pro fejlesztőnként havidíjas |
| Azonnali csere spike nélkül | Ha az adapter a `proxy.ts`-t vagy az ISR-t nem kezeli, a multi-brand menet közben törik |
| Next.js is a VPS-en (Docker) | Egy hely és natív Next, de nincs PR-preview és edge, az egész üzemeltetés a miénk |
| Vercel párhuzamosan megtartva | Két deploy-cél és két env-készlet karbantartása; a spike után nincs rá szükség |
