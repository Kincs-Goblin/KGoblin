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
- **Merge-kapu:** zöld CI (a `main`-re menő PR-okon; a `demo` PR-on helyette a helyi release-teszt) + lezárt
  független AI review-ciklus + **bármelyik fejlesztő kifejezett „mehet”-je** (a szerzőé is elég). A másik
  fejlesztő GitHub-jóváhagyása nem feltétel; ha változtatást kér, azt kezelni kell.
- A ticketet a **felelőse** (Jira-assignee) viszi végig PR-ig, tesztekkel és review-ciklussal együtt; a
  reviewer csak findingot ad, a munkát nem veszi át. Részletek: `kg-ticket-to-pr` → Felelősség.
- Ticketek: Jira, `KG` projekt. Link: `https://kincsgoblin.atlassian.net/browse/KG-123`.
- Terv: `docs/project-plan.md` · Döntések: `docs/adr/` · Ticket-sablon: `docs/process/ticket-template.md` ·
  Első lépések: `docs/process/onboarding.md`.
- Állapot: 0. mérföldkő. Kész: monorepo-váz, `apps/web` váz és gamer téma, `packages/brand-config`, CI (KG-5).

## Stack röviden

A teljes, státuszos döntésnapló a `kg-stack` skillben van; ütközésnél az az irányadó.

- **Frontend:** Next.js (App Router) + TypeScript, Tailwind + shadcn/ui Base UI-jal, Motion az animációkhoz,
  FSD 3. szint (`apps/web`), Vercel.
- **Commerce:** WooCommerce brandenként külön példányban. Store API a katalógushoz, kosárhoz és
  checkouthoz; REST v3 csak szerveroldalon. Minden Woo-válasz Zod-dal validálva.
- **Háttérjobok:** Trigger.dev (`apps/jobs`): beszállítói feed-szinkron, rendelés-továbbítás, újrapróba.
- **Fizetés:** Stripe, Barion, SimplePay (Woo gateway pluginek). **Számlázás:** Billingo.
- **Auth:** Woo customer + vendég checkout, token httpOnly cookie-ban.
- **Keresés:** Meilisearch. **Email:** Resend + React Email.
- **Mérés:** Sentry, PostHog, Meta Conversions API, Google Merchant Center feed.
- **Monorepo:** pnpm + Turborepo. **WordPress hosting:** nyitott.

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
| `apps/jobs/` | Trigger.dev taskok (lapos szerkezet: `trigger/`, `domain/`, `adapters/`) |
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
- „Nézd meg”, „adj tervet”, „review-zd”, „ne kódolj”: kizárólag read-only munka.
- Széles vagy kockázatos változtatás előtt rövid, jóváhagyott terv. Nyitott döntést opciós kérdésként tegyél
  fel, ne prózában. Kis, egyértelmű javításnál ez felesleges.
- A legkisebb működő megoldás, kéretlen refaktor és scope-bővítés nélkül. A scope-on túli észrevételt
  külön jelezd.
- Több értelmezésnél nevezd meg, melyiket választottad és miért.
- Külső rendszerbe (Jira, Woo admin, Vercel, Trigger.dev, Billingo, éles adat) csak kifejezett kérésre írj.
- Titok soha nem kerül a kódba, a logba, a memóriába vagy a frontendbe (`NEXT_PUBLIC_*` csak publikus érték).
- A FSD-rétegszabály, a Woo-adatréteg és a brandkezelés szabályai a `kg-architecture` skillben vannak.

## Parancsok

Node a `.nvmrc` szerint (26; a 22.12 alatti Node-dal a Tailwind 4 build elbukik), pnpm a `packageManager` szerint.

```bash
pnpm install
pnpm dev                                   # apps/web: http://gamer.localhost:3000 (a host választ brandet)
pnpm turbo run typecheck lint test build   # quality gate; a web lintje a Steigert is futtatja
pnpm --filter @kg/web test:e2e             # Playwright smoke (desktop + mobil)
```

A CI (GitHub Actions, `.github/workflows/ci.yml`) ugyanezt futtatja minden `main`-re menő PR-on; a `demo`
PR-ok kapuja a helyi release-teszt.

## Git röviden

Részletek: `kg-git-workflow`, döntés: ADR-0007 (a Tinati-workflow alapján). Ágak: `main` (éles kód), `demo`
(ügyfélteszt), ticketág `KG-<n>`, helyi `release/ÉÉÉÉ-HH-NN` tesztág, `version/vX.Y.Z`.

- Ticketág pontosan a kulcsról (`KG-42`), friss `origin/main`-ből, saját worktree-ben. Helyi
  `release/<dátum>` ágon összetesztelve (`--no-ff`, nem pusholjuk), majd ticketenként PR a `demo`-ra
  (merge commit). Élesítés: egyetlen `demo` → `main` PR, squash, zöld CI-vel. Hotfix: `KG-<n>` → `main`.
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

## Kommunikáció

- Magyarul, röviden; a technikai kifejezések maradhatnak angolul.
- Magyar szövegben ékezet, `&` helyett „és”, gondolatjel helyett sima kötőjel.
- A hosszú anyag fájlba megy, a chaten csak az összefoglaló.
