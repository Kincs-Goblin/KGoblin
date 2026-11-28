# KGoblin - agent-szabályok

Ez a fájl az egyetlen közös szabályforrás minden AI agentnek, eszköztől függetlenül. A `CLAUDE.md`
csak importálja. Ha egy skill ütközik ezzel a fájllal, ez az irányadó; jelezd, hogy a skillt frissíteni kell.

## A projekt

Headless, több brandet kiszolgáló dropshipping webshop-platform. Az első brand gamer tematikájú, később
további niche-shopok jönnek ugyanarra a kódbázisra. Egy Next.js frontend domain alapján szolgálja ki a
brandeket; minden brand mögött saját WordPress + WooCommerce backend van.

- Csapat: **SMark2256** és **ricsmond12**, egyenrangú szerepben: mindketten bármilyen ticketet, release-t,
  demót és hotfixet vihetnek. A szerep PR-onként dől el: aki nyitja, a **szerző**; a **másik fejlesztő**
  opcionálisan review-zhat.
- **Merge-kapu:** zöld CI (a `main`-re és a `demo`-ra menő PR-okon; ADR-0011) + lezárt
  független AI review-ciklus + **bármelyik fejlesztő kifejezett „mehet”-je** (a szerzőé is elég). A másik
  fejlesztő GitHub-jóváhagyása nem feltétel; ha változtatást kér, azt kezelni kell.
- A ticketet a **felelőse** (Jira-assignee) viszi végig PR-ig, tesztekkel és review-ciklussal együtt; a
  reviewer csak findingot ad, a munkát nem veszi át. Részletek: `kg-ticket-to-pr` → Felelősség.
- Ticketek: Jira, `KG` projekt. Link: `https://kincsgoblin.atlassian.net/browse/KG-123`.
- Terv: `docs/project-plan.md` · Döntések: `docs/adr/` · Ticket-sablon: `docs/process/ticket-template.md` ·
  Első lépések: `docs/process/onboarding.md`.
- Állapot: 0. mérföldkő kiadva (v0.1.0), az 1. (katalógus) folyamatban; részletek: `docs/project-plan.md`.

## Stack röviden

A teljes, státuszos döntésnapló a `kg-stack` skillben van; ütközésnél az az irányadó.

- **Frontend:** Next.js (App Router) + TypeScript, Tailwind + shadcn/ui Base UI-jal, Motion az animációkhoz,
  FSD 3. szint (`apps/web`), Cloudflare Workers + OpenNext, Workers Builds (ADR-0009). A kosár-BFF rate
  limitje a Workers Rate Limiting binding (ADR-0018).
- **Commerce:** WooCommerce brandenként külön példányban. Store API a katalógushoz, kosárhoz és
  checkouthoz; REST v3 csak szerveroldalon. Minden Woo-válasz Zod-dal validálva.
- **Háttérjobok:** Trigger.dev (`apps/jobs`): beszállítói feed-szinkron, rendelés-továbbítás, újrapróba.
- **Fizetés:** Stripe (`woocommerce-gateway-stripe` + `@stripe/stripe-js`), Barion
  (`pay-via-barion-for-woocommerce`), SimplePay (`wpxpert-payment-gateway-for-simplepay`, v2.1) Store API
  checkouton át (ADR-0017; bevezetés: `KG-13`). **Számlázás:** Billingo (Trigger.dev `issue-invoice` task,
  API v3; ADR-0015).
- **Auth:** Woo customer + vendég checkout, saját `kg-headless` JWT auth (15p access + rotált refresh,
  ADR-0016; tervezett: `KG-15`), tokenek httpOnly cookie-ban.
- **Keresés:** Meilisearch (saját Docker a VPS-en, Cloudflare Tunnel mögött; ADR-0012). **Képek:** Woo médiatár +
  Cloudflare CDN és Images binding (ADR-0009, ADR-0013). **Email:** Resend + React Email.
- **Mérés:** Sentry, PostHog, Meta Conversions API, Google Merchant Center feed.
- **Monorepo:** pnpm + Turborepo. **WordPress hosting:** saját VPS + Docker Compose, Cloudflare (DNS, WAF,
  Tunnel) mögött (ADR-0008); a `demo` környezethez brandenként külön demo-Woo sandbox módban (ADR-0014).

## Stack-változás (kötelező szabály)

Ha egy feladat új szolgáltatást, könyvtár-kategóriát, hostingot, adatfolyamot vagy külső integrációt hozna
be, vagy a fenti döntések bármelyikét cserélné: **állj meg, és kérdezz** opciós kérdéssel (2-4 opció,
a javasolt elöl). Elfogadott döntésnél **ugyanabban a PR-ban**:

1. új ADR a `docs/adr/` alatt (`0000-sablon.md` alapján);
2. a `kg-stack` skill döntésnaplójának frissítése (státusz, dátum, ADR-link);
3. a fenti „Stack röviden” és minden érintett skill (pl. `kg-architecture`) frissítése.

Stack-változást csendben, „mellékesen” bevezetni tilos. Részletek: `kg-stack` skill.

## Repo-térkép

| Hely | Mi |
|---|---|
| `apps/web/` | Next.js storefront. Next-routing: `app/`; FSD-rétegek: `src/` |
| `apps/jobs/` | Trigger.dev taskok (lapos szerkezet: `src/trigger/`, `src/domain/`, `src/adapters/`) |
| `packages/woo-client/` | Store API + REST v3 kliens, Zod-sémák, webhook-aláírás |
| `packages/brand-config/` | brandek: domainek, tokenek, Woo-végpontok, fizetési módok |
| `packages/config/` | közös tsconfig, ESLint, Prettier presetek |
| `wordpress/plugins/kg-headless/` | saját headless WooCommerce bővítmény (Store API checkout validáció, Omnibus, redirect) |
| `wordpress/seed/` | brandenként paraméterezhető WP-CLI tesztadat-seed (`seed-brand.php`) és PHP unit-tesztek |
| `wordpress/docker/` | lokális többbrandes Docker setup (`setup.ps1`, `setup.sh`, `init-multi-db.sh`) és Store API tesztek |
| `docs/` | terv, ADR-ek, folyamatleírások |
| `.agents/skills/` | a skillek forrása (Antigravity innen olvas) |
| `.agents/workflows/` | Antigravity slash-workflow-k, a skillekre mutatnak |
| `.claude/skills/` | Claude Code mutatók az `.agents/skills/` fájljaira |
| `.gemini/settings.json` | Gemini CLI: az `AGENTS.md`-t tölti be kontextusként |

## Skillek

A forrás mindig `.agents/skills/<név>/SKILL.md`. A `.claude/skills/<név>/SKILL.md` csak mutató: új skillnél
mindkettőt hozd létre, a név és a leírás egyezzen. A skillek és a workflow-k eszköz- és modellfüggetlenek;
eszközfüggő részlet (session indítása, PR-figyelés, memória helye) csak a `docs/process/agent-adapters.md`-be
kerül (ADR-0006).

| Skill | Mikor |
|---|---|
| `kg-stack` | stack-kérdés, új függőség vagy szolgáltatás, döntés rögzítése |
| `kg-architecture` | hova kerüljön a kód, FSD, Woo-integráció, multi-brand, hibakódok |
| `kg-git-workflow` | branch, commit, merge, demo, hotfix |
| `kg-ticket-to-pr` | Jira-ticket végigvitele PR-ig, review-ciklus |
| `kg-ticket-refine` | ticket ellenőrzése és átfogalmazás-javaslat munka előtt (DoR, frissesség, ellentmondás a repóval) |
| `kg-pr-review` | PR review-ja a ticket ellen (AC-leképezés, állítások ellenőrzése, ellentmondások); csak findingot ad |
| `kg-release` | helyi release-teszt, demo PR-ok, version PR, demo → main, GitHub release, hotfix |
| `kg-dev-practices` | tervezési elvek, tesztelés, biztonság, külső API-k, Windows-csapdák |
| `kg-knowledge` | „jegyezd meg”: hová kerüljön egy tény (repó vagy memória) |
| `kg-full-stop` | „full stop”: felügyelet nélkül merge-elhető PR-ig |
| `kg-babysit-pr` | PR CI-jának és review-jának követése |
| `kg-council` | többmodelles review-zsűri pontozással |

## Hogyan dolgozz

- A tényleges állapotból indulj. Kódos munka előtt `git status --short`; idegen módosítást ne revertelj.
- **Ticketenként külön git worktree:** az agent minden ticketet saját worktree-ben, saját ticketágon fejleszt,
  soha nem a fő checkoutban és nem egy másik ticket worktree-jében. Egy worktree = egy ticket (a ticket
  stacked PR-ágai együtt). Menete: `kg-git-workflow` → Worktree.
- „Nézd meg”, „adj tervet”, „review-zd”, „ne kódolj”: kizárólag read-only munka. PR-review: `kg-pr-review`.
- **A ticket sem tény.** Munka előtt vesd össze a ticketet a friss `origin/demo`-val és az azóta elfogadott
  ADR-ekkel (`kg-ticket-refine`); ellentmondásnál állj meg és jelezd, ne építs a repó ellenében. A repóról
  leírt állítást (dokumentum, ADR, PR-leírás) ellenőrizd `git grep`-pel vagy futtatással, mielőtt leírod.
- Széles vagy kockázatos változtatás előtt rövid, jóváhagyott terv. Nyitott döntést opciós kérdésként tegyél
  fel, ne prózában. Kis, egyértelmű javításnál ez felesleges.
- A legkisebb működő megoldás, kéretlen refaktor és scope-bővítés nélkül. A scope-on túli észrevételt
  külön jelezd.
- Több értelmezésnél nevezd meg, melyiket választottad és miért.
- Külső rendszerbe (Jira, Woo admin, Cloudflare, Trigger.dev, Billingo, éles adat) csak kifejezett kérésre írj.
- Titok soha nem kerül a kódba, a logba, a memóriába vagy a frontendbe (`NEXT_PUBLIC_*` csak publikus érték).
- A FSD-rétegszabály, a Woo-adatréteg és a brandkezelés szabályai a `kg-architecture` skillben vannak.

## Parancsok

Node a `.nvmrc` szerint (26; a 22.12 alatti Node-dal a Tailwind 4 build elbukik), pnpm a `packageManager` szerint.

```bash
pnpm install
pnpm dev                                   # apps/web: http://gamer.localhost:3000 (a host választ brandet)
pnpm format:check                          # Prettier (a CI is futtatja)
pnpm turbo run typecheck lint test build   # quality gate; a web lintje a Steigert is futtatja
# CI=1 mellett (CI, sok agent-harness) a build, a dev és a start is kéri: helyben NEXT_PUBLIC_APP_ENV=local
pnpm --filter @kg/web test:e2e             # Playwright smoke (desktop + mobil)
```

A CI (GitHub Actions, `.github/workflows/ci.yml`) ugyanezt futtatja minden `main`-re és `demo`-ra menő PR-on
(ADR-0011), plusz egy PHP-jobot `php:8.2-cli` image-ben: `php -l`, `wordpress/seed/test-omnibus.php` és
`wordpress/seed/test-headless-guards.php`. Helyben ugyanez:
`docker run --rm -v "$PWD:/repo" -w /repo php:8.2-cli php wordpress/seed/<teszt>.php`. A helyi release-teszt a
több ticket együttes próbája marad.

## Git röviden

Részletek: `kg-git-workflow`, döntés: ADR-0007 (a Tinati-workflow alapján) és ADR-0010 (ticketág a
demóból). Ágak: `main` (éles kód), `demo` (ügyfélteszt), ticketág `KG-<n>`, helyi `release/ÉÉÉÉ-HH-NN`
tesztág, `version/vX.Y.Z`.

- Ticketág pontosan a kulcsról (`KG-42`), friss `origin/demo`-ból, saját worktree-ben. Helyi
  `release/<dátum>` ágon összetesztelve (`--no-ff`, nem pusholjuk), majd ticketenként PR a `demo`-ra
  (merge commit); a ticket itt véget ér. Élesítés csak külön kérésre: egyetlen `demo` → `main` PR, squash,
  zöld CI-vel. Hotfix: `KG-<n>` friss `origin/main`-ből → `main`.
- Közvetlen push a `main`-re és a `demo`-ra nincs, kis fixre sem.
- Commit és PR-cím angolul, Conventional Commits: `feat(KG-42): add cart drawer`. A PR-leírás magyarul.
- **AI-val készült commit** az eszköz `Co-Authored-By` footerét kapja; a PR-leírásban és az ágnévben nincs
  AI-jelölés („Generated with”, 🤖).
- Commit, push, PR-nyitás, merge, tag, deploy és Jira-írás csak kifejezett kérésre.
- Stage-elj fájlonként (`git add -A` nem); push előtt `git diff --stat`, aztán `git diff`.

## Kész állapot

- A változáshoz szükséges ellenőrzés (typecheck, lint, Steiger, teszt, build, böngészős próba) lefutott.
  A kész-jelentés megnevezi, mit futtattál és mi lett az eredménye; amit nem ellenőriztél, azt kimondod.
- A skipelt teszt nem sikeres teszt. A „kész” és a „kész, de böngészőben nem próbáltam” két külön állapot.
- Minden elfogadási kritériumhoz bizonyíték vagy kimondott „nem ellenőrzött”. Külső rendszer viselkedését
  (pl. Woo REST-hitelesítés) fixture-zöld nem igazolja; a PR-leírás a bizonyítékokkal együtt frissül.

## Kommunikáció

- Magyarul, röviden; a technikai kifejezések maradhatnak angolul.
- Magyar szövegben ékezet, `&` helyett „és”, gondolatjel helyett sima kötőjel.
- A hosszú anyag fájlba megy, a chaten csak az összefoglaló.
