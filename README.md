# KGoblin

Headless, több brandet kiszolgáló dropshipping webshop-platform. Egy Next.js storefront a domain alapján
szolgálja ki a brandeket, minden brand mögött saját WordPress + WooCommerce backend áll. Az első brand gamer
tematikájú, később további niche-shopok jönnek ugyanarra a kódbázisra, kódmásolás nélkül.

> **Állapot:** tervezési fázis. Alkalmazáskód még nincs, csak a mappastruktúra, a döntések és a
> fejlesztési szabályok. A következő lépés a 0. mérföldkő (monorepo-scaffold).

## Architektúra

```
 böngésző ──► Vercel: Next.js (apps/web, FSD) ──┬──► Woo #1 (gamer)   Store API / REST v3
             domain → brand (proxy)             ├──► Woo #2 (brand 2)
             ISR + revalidateTag                │
                    ▲  webhook (HMAC)           └──► Meilisearch (index brandenként)
                    │
             Woo #n ─┘──► Trigger.dev (apps/jobs) ──► beszállítók (feed, rendelés)
                                                 ├──► Billingo (számla)
                                                 ├──► Resend (email)
                                                 └──► Meta CAPI, Merchant feed
 Sentry + PostHog: web és jobs
```

- A WooCommerce a kereskedelmi logika forrása (ár, adó, kupon, készlet, rendelés); a frontend nem számol.
- A böngésző nem hívja közvetlenül a WordPresst: a Next.js szerveroldala a BFF, minden Woo-válasz Zod-dal
  validálva.
- A beszállítói feed-szinkron és a rendelés-továbbítás háttérjobként fut, idempotens módon.

## Stack

| Terület | Választás |
|---|---|
| Frontend | Next.js (App Router) + TypeScript, Tailwind + shadcn/ui, FSD 3. szint, Vercel |
| Commerce | WooCommerce brandenként külön példányban; Store API, REST v3 csak szerveroldalon |
| Háttérjobok | Trigger.dev: feed-szinkron, rendelés-továbbítás, újrapróba |
| Fizetés | Stripe, Barion, SimplePay (Woo gateway pluginek) |
| Számlázás | Billingo |
| Auth | Woo customer + vendég checkout, token httpOnly cookie-ban |
| Keresés | Meilisearch, index brandenként |
| Email | Resend + React Email |
| Mérés | Sentry, PostHog, Meta Conversions API, Google Merchant Center feed |
| Monorepo | pnpm + Turborepo |
| Nyitott | WordPress hosting, demo/staging Woo, auth plugin, Billingo-bekötés módja, Meilisearch hosting, kép-CDN |

A teljes, státuszos döntésnapló: [`.agents/skills/kg-stack/SKILL.md`](.agents/skills/kg-stack/SKILL.md),
az indoklások: [`docs/adr/`](docs/adr/).

## Repó-térkép

| Hely | Mi |
|---|---|
| [`apps/web/`](apps/web/) | Next.js storefront. Next-routing: `app/`; FSD-rétegek: `src/` |
| [`apps/jobs/`](apps/jobs/) | Trigger.dev taskok (`trigger/`, `domain/`, `adapters/`) |
| [`packages/woo-client/`](packages/woo-client/) | Store API + REST v3 kliens, Zod-sémák, webhook-aláírás |
| [`packages/brand-config/`](packages/brand-config/) | brandek: domainek, tokenek, Woo-végpontok, fizetési módok |
| [`packages/config/`](packages/config/) | közös tsconfig, ESLint, Prettier presetek |
| [`docs/`](docs/) | projektterv, ADR-ek, folyamatleírások |
| `.agents/`, `.claude/`, `.gemini/` | AI agent-szabályok, skillek és workflow-k |

## Mérföldkövek

| # | Mérföldkő | Tartalom |
|---|---|---|
| 0 | Alapok | monorepo-scaffold, lint, tesztek, CI, Vercel-projekt, lokális Woo, brand-config az 1. brandre |
| 1 | Katalógus | főoldal, kategória, termékoldal, keresés, ISR + webhook-revalidálás, SEO, brand-téma |
| 2 | Kosár és checkout | Store API kosár, kupon, szállítás, Stripe + Barion + SimplePay, vendég checkout |
| 3 | Dropshipping | beszállítói adapter, feed-szinkron, árazási szabályok, rendelés-továbbítás |
| 4 | Fiók, számla, email | Woo-fiók, Billingo, Resend + React Email sablonok |
| 5 | Mérés és indulás | Sentry, PostHog, Meta CAPI, Merchant feed, jogi oldalak, éles hosting - **1.0.0** |
| 6 | 2. brand | új brand a multi-brand checklist szerint, kódmásolás nélkül |

Részletek, kockázatok és nyitott döntések: [`docs/project-plan.md`](docs/project-plan.md).

## Fejlesztés

- **Első lépések** (klónozás, agent beállítása, ellenőrzés): [`docs/process/onboarding.md`](docs/process/onboarding.md)
- **Közös szabályok** minden fejlesztőnek és AI agentnek (Claude Code, Antigravity, Gemini CLI):
  [`AGENTS.md`](AGENTS.md)
- **Ticketek:** Jira, `KG` projekt; sablon: [`docs/process/ticket-template.md`](docs/process/ticket-template.md)
- **Git:** ticketág friss `origin/main`-ből (`feat/KG-42-cart-drawer`), PR az aktív `release/ÉÉÉÉ-HH-NN`
  ágba, squash merge, Conventional Commits angolul. Részletek: `kg-git-workflow` skill.
- **Stack-változás** csak új ADR-rel és a `kg-stack` döntésnapló frissítésével, ugyanabban a PR-ban.

## Korábbi prototípus

A gyökérben lévő `wordpress/`, `docker-compose.yml` és `setup-webshop.ps1` a korábbi, klasszikus WP-témás
prototípus (`custom-shop` téma, `hu-webshop-core` plugin: magyar pénztármezők, jogi nyilatkozatok,
Omnibus 30 napos legalacsonyabb ár). Új munka nem épít rá; az átalakítása vagy eltávolítása külön ticket.
Lokális indítása (Docker Desktop szükséges):

```powershell
powershell -ExecutionPolicy Bypass -File .\setup-webshop.ps1
# http://localhost:8080 (admin: http://localhost:8080/wp-admin)
```

## Csapat

[SMark2256](https://github.com/SMark2256) és [ricsmond12](https://github.com/ricsmond12), egyenrangú
szerepben: aki a PR-t nyitja, a szerző, a másik fejlesztő a reviewer.
