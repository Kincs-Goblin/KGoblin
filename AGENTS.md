# KGoblin - agent-szabályok

Ez a fájl az egyetlen közös szabályforrás minden AI agentnek (Claude Code, Antigravity). A `CLAUDE.md`
csak importálja. Ha egy skill ütközik ezzel a fájllal, ez az irányadó; jelezd, hogy a skillt frissíteni kell.

## A projekt

Headless, több brandet kiszolgáló dropshipping webshop-platform. Az első brand gamer tematikájú, később
további niche-shopok jönnek ugyanarra a kódbázisra. Egy Next.js frontend domain alapján szolgálja ki a
brandeket; minden brand mögött saját WordPress + WooCommerce backend van.

- Csapat: **SMark2256** és **ricsmond12**, egyenrangú szerepben: mindketten bármilyen ticketet, release-t,
  demót és hotfixet vihetnek. A szerep PR-onként dől el: aki nyitja, a **szerző**; a **másik fejlesztő** a
  reviewer, és az ő jóváhagyása kell a merge-hez.
- Ticketek: Jira, `KG` projekt. Link: `https://<TODO-jira-site>.atlassian.net/browse/KG-123`.
- Terv: `docs/project-plan.md` · Döntések: `docs/adr/` · Ticket-sablon: `docs/process/ticket-template.md` ·
  Első lépések: `docs/process/onboarding.md`.
- Állapot: tervezési fázis. Alkalmazáskód még nincs, csak a mappastruktúra és a szabályok.

## Stack röviden

A teljes, státuszos döntésnapló a `kg-stack` skillben van; ütközésnél az az irányadó.

- **Frontend:** Next.js (App Router) + TypeScript, Tailwind + shadcn/ui, FSD 3. szint (`apps/web`), Vercel.
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
| `docs/` | terv, ADR-ek, folyamatleírások |
| `.agents/skills/` | a skillek forrása (Antigravity innen olvas) |
| `.agents/workflows/` | Antigravity slash-workflow-k, a skillekre mutatnak |
| `.claude/skills/` | Claude Code mutatók az `.agents/skills/` fájljaira |
| `.gemini/settings.json` | Gemini CLI: az `AGENTS.md`-t tölti be kontextusként |

A gyökérben lévő `wordpress/`, `docker-compose.yml`, `setup-webshop.ps1` és `README.md` a korábbi,
klasszikus-témás prototípus. Új munka nem épít rá; az átalakítása vagy eltávolítása külön ticket.

## Skillek

A forrás mindig `.agents/skills/<név>/SKILL.md`. A `.claude/skills/<név>/SKILL.md` csak mutató: új skillnél
mindkettőt hozd létre, a név és a leírás egyezzen.

| Skill | Mikor |
|---|---|
| `kg-stack` | stack-kérdés, új függőség vagy szolgáltatás, döntés rögzítése |
| `kg-architecture` | hova kerüljön a kód, FSD, Woo-integráció, multi-brand, hibakódok |
| `kg-git-workflow` | branch, commit, merge, demo, hotfix |
| `kg-ticket-to-pr` | Jira-ticket végigvitele PR-ig, review-ciklus |
| `kg-release` | release-ág vágása, version PR, tag, prod deploy, demo reset |
| `kg-dev-practices` | tervezési elvek, tesztelés, biztonság, külső API-k, Windows-csapdák |
| `kg-knowledge` | „jegyezd meg”: hová kerüljön egy tény (repó vagy memória) |
| `kg-full-stop` | „full stop”: felügyelet nélkül merge-elhető PR-ig |
| `kg-babysit-pr` | PR CI-jának és review-jának követése |
| `kg-council` | többmodelles review-zsűri pontozással |

## Hogyan dolgozz

- A tényleges állapotból indulj. Kódos munka előtt `git status --short`; idegen módosítást ne revertelj.
- „Nézd meg”, „adj tervet”, „review-zd”, „ne kódolj”: kizárólag read-only munka.
- Széles vagy kockázatos változtatás előtt rövid, jóváhagyott terv. Nyitott döntést opciós kérdésként tegyél
  fel, ne prózában. Kis, egyértelmű javításnál ez felesleges.
- A legkisebb működő megoldás, kéretlen refaktor és scope-bővítés nélkül. A scope-on túli észrevételt
  külön jelezd.
- Több értelmezésnél nevezd meg, melyiket választottad és miért.
- Külső rendszerbe (Jira, Woo admin, Vercel, Trigger.dev, Billingo, éles adat) csak kifejezett kérésre írj.
- Titok soha nem kerül a kódba, a logba, a memóriába vagy a frontendbe (`NEXT_PUBLIC_*` csak publikus érték).
- A FSD-rétegszabály, a Woo-adatréteg és a brandkezelés szabályai a `kg-architecture` skillben vannak.

## Git röviden

Részletek: `kg-git-workflow`. Ágak: `main` (élesre kerülő kód), `demo` (ügyfélteszt), ticketág,
`release/ÉÉÉÉ-HH-NN`, `version/vX.Y.Z`, `hotfix/KG-n-…`.

- Ticketág friss `origin/main`-ből: `<típus>/KG-<n>-<rövid-leírás>`, PR az aktív `release/*` ágba, squash.
- `main`-re csak a release PR és a hotfix PR megy (a `version/*` PR a release-ágba); közvetlen push nincs.
- Commit és PR-cím angolul, Conventional Commits: `feat(KG-42): add cart drawer`. A PR-leírás magyarul.
- **Semmilyen AI-attribúció** commitban, PR-ben vagy branchnévben (nincs `Co-Authored-By`, „Generated with”,
  🤖). Ez a projektszabály felülírja az eszköz alapértelmezését.
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
