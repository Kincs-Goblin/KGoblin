# ADR-0009: Frontend hosting - Cloudflare Workers (OpenNext), spike után

- Állapot: javasolt
- Dátum: 2026-11-13
- Döntéshozók: SMark2256, ricsmond12
- Ticket: KG-29 (döntés), KG-118 (spike)
- Felváltaná: az ADR-0001 „Frontend hosting” sorát (Vercel)

## Kontextus

- Az ADR-0001 szerint az `apps/web` a Vercelen fut (preview deploy PR-onként, production a `main`-ről). A
  KG-6 ehhez elkészítette az `apps/web/vercel.json`-t és a `VERCEL_ENV`-re is figyelő `noindex` logikát.
- Az ADR-0008 óta a backend előtt Cloudflare áll (DNS, WAF, Tunnel), és a képekhez is az R2 a jelölt. Ha a
  frontend is ott fut, egy szolgáltatónál van a DNS, a domainek, a frontend és a backend-védelem.
- A Vercel Hobby csomagja nem kereskedelmi célra szól; egy webshophoz Pro kell, fejlesztőnként havidíjjal.
  A Cloudflare Workers fizetős csomagja fiókszintű, kis fix díjjal.
- A Next.js a Cloudflare-en nem natívan, hanem az OpenNext adapterrel (`@opennextjs/cloudflare`) fut
  Workersen. Nyitott kérdések a mi kódunkra:
  - a Next 16 `proxy.ts` (Node runtime) támogatása - ezen múlik a domain → brand feloldás;
  - ISR és `revalidateTag` (adapteroldali incremental és tag cache: R2/KV, D1 vagy Durable Objects);
  - `next/image` (Cloudflare Images vagy saját loader);
  - a Worker méretkorlátja és a hidegindulás;
  - branchenkénti preview URL (Workers Builds) a PR-okhoz és a `demo` ághoz.

## Döntés

- Cél: az `apps/web` a Cloudflare Workersen fut az OpenNext adapterrel; a production a `main`-ről, a demo a
  `demo` ágról, PR-onként preview URL.
- Előfeltétel a spike-ticket (KG-118), amely a mostani `apps/web`-et Workersre deployolja, és bizonyítja: a
  `proxy.ts` brandválasztása, a fixture-ös katalógus (`KG_STORE_FIXTURES=1`), az ISR és a `revalidateTag`,
  a `next/image` és a `noindex` fejléc működik, a PR-preview elkészül.
- Ha a spike sikeres, ez az ADR „elfogadott” lesz, és a migrációs ticket lecseréli a Vercel-konfigurációt.
  Ha nem, a spike eredménye és az ok ide kerül, az ADR nem lesz elfogadva, és a Vercel marad.
- A spike végéig a Vercel a frontend hosting; a Vercel-konfigurációt addig nem bontjuk le.

## Következmények

- Elfogadás esetén a migrációs ticketben:
  - `apps/web/vercel.json` helyett `wrangler.jsonc` és `open-next.config.ts`; a `turbo-ignore` megfelelője
    a Workers Builds build-szűrőjében;
  - a `VERCEL_ENV`-függés (`apps/web/next.config.ts`, `apps/web/src/shared/config/env.ts`) lecserélése a
    `NEXT_PUBLIC_APP_ENV`-re vagy egy Cloudflare-oldali megfelelőre;
  - frissítendő: ADR-0001 (a „Frontend hosting” sor felváltva), `kg-stack`, `AGENTS.md`,
    `docs/project-plan.md` architektúra-ábrája és 0. mérföldköve, `docs/process/infrastructure.md`,
    `kg-release` (Production), `kg-dev-practices` (env helye), `kg-babysit-pr` (build-flake),
    `kg-architecture/references/multi-brand.md` (env és domain).
- A brand fődomainje Cloudflare DNS-en és a Workers custom domainjén lesz, az `api.` aldomain a VPS-re mutat
  (ADR-0008).
- Most frissítve: `kg-stack` („Frontend hosting” sor mellé a javasolt cél), `AGENTS.md` „Stack röviden”.

## Mérlegelt alternatívák

| Alternatíva | Miért nem |
| ----------- | --------- |
| Marad a Vercel | Natív Next-támogatás, de két szolgáltató, és a Pro fejlesztőnként havidíjas |
| Azonnali csere spike nélkül | Ha az adapter a `proxy.ts`-t vagy az ISR-t nem kezeli, a multi-brand menet közben törik |
| Next.js is a VPS-en (Docker) | Egy hely és natív Next, de nincs PR-preview és edge, az egész üzemeltetés a miénk |
