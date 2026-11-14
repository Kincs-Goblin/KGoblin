# KGoblin - projektterv

- Állapot: tervezés, alkalmazáskód még nincs
- Utolsó módosítás: 2026-11-12
- Csapat: SMark2256, ricsmond12 (+ AI agentek: Claude Code, Antigravity)

## Cél

Headless, dropshipping alapú webshop-platform, amelyen egy kódbázisból több tematikus shop (brand) fut.
Az első brand **gamer tematikájú**. Ezt követik további niche-shopok, saját domainnel, arculattal és saját
WooCommerce-szel, de közös frontenddel, közös integrációkkal és közös háttérjobokkal.

Sikerkritérium az első brandre: a vásárló mobilon is gyorsan megtalálja és megveszi a terméket
(Stripe, Barion vagy SimplePay), a rendelés emberi beavatkozás nélkül eljut a beszállítóhoz, a számla
kimegy, és a hirdetési tracking (Meta CAPI, Merchant feed) mérhetően működik.

## Architektúra egy képben

```
 böngésző ──► CF Workers: Next.js (apps/web) ───┬──► Woo #1 (gamer)   Store API / REST v3
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

Hosting: a Woo-példányok saját VPS-en, Docker Compose-zal, Cloudflare (DNS, WAF, Tunnel) mögött futnak
(ADR-0008). A frontend Cloudflare Workersen fut az OpenNext adapterrel (ADR-0009).

A részletes döntések a `kg-stack` skillben (`.agents/skills/kg-stack/SKILL.md`) és a `docs/adr/` alatt vannak.

## Mérföldkövek

| # | Mérföldkő | Tartalom | Verzió |
|---|---|---|---|
| 0 | Alapok | monorepo-scaffold (pnpm, Turborepo, Next, Trigger.dev, packages), lint, Steiger, Vitest, Playwright, CI, branch protection, frontend hosting (Cloudflare Workers), lokális Docker-Woo, `kg-headless` plugin váz, brand-config az 1. brandre | 0.1.0 |
| 1 | Katalógus | főoldal, kategória, termékoldal, keresés (Meilisearch), ISR + webhook-revalidálás, SEO (metaadatok, sitemap, strukturált adat), brand-téma | 0.2.0 |
| 2 | Kosár és checkout | Store API kosár, kupon, szállítási mód, checkout, Stripe + Barion + SimplePay, rendelés-visszaigazolás, vendég checkout | 0.3.0 |
| 3 | Dropshipping | 1. beszállító adaptere, feed-szinkron, árazási szabályok, rendelés-továbbítás, státusz-visszaírás | 0.4.0 |
| 4 | Fiók, számla, email | Woo-fiók (login, regisztráció, rendeléseim), Billingo, Resend + React Email sablonok | 0.5.0 |
| 5 | Mérés és indulás | Sentry, PostHog, Meta CAPI, Merchant feed, jogi oldalak, teljesítmény- és biztonsági átnézés, éles Woo-hosting | **1.0.0** |
| 6 | 2. brand | új brand a `multi-brand.md` checklistje szerint, kódmásolás nélkül | 1.x |

A mérföldkövek sorrendje irányadó, a verziószámok a kiadáskor dőlnek el (`kg-release`).

## Kockázatok

| Kockázat | Hatás | Kezelés |
|---|---|---|
| A gateway pluginek nem (teljesen) támogatják a Store API checkoutot | a 2. mérföldkő csúszik | spike-ticket az 1. mérföldkő alatt mindhárom gatewayre |
| Beszállítói feed minősége, hiányzó EAN/SKU | hibás vagy duplikált termékek | Zod-validálás, futási riport, kézi jóváhagyás az első importnál |
| Brandenként külön Woo = több üzemeltetés | frissítési és biztonsági teher | közös plugin-lista és -verzió, frissítési runbook, hosting: VPS + Docker (ADR-0008) |
| Bizonytalan beszállítói rendelés-API (dupla rendelés) | pénzügyi kár | idempotencia-kulcs, nincs vak újrapróba (`jobs-and-suppliers.md`) |
| Jogi megfelelés (ÁSZF, elállás, Omnibus-ár, adatkezelés, cookie-hozzájárulás) | bírság, hirdetési fiók tiltása | a Woo oldalon számolva, jogi oldalak az indulás előtt, cookie-banner a tracking előtt |
| Szállítási idő dropshippingnél | vásárlói panasz | várható szállítási idő a termékoldalon, beszállítónként |

## Nyitott döntések

A `kg-stack` „nyitott” státuszú sorai: VPS-szolgáltató · demo/staging Woo · auth plugin · Billingo-bekötés
módja · Meilisearch hosting · kép-CDN. Ezen felül: az 1. beszállító(k) kiválasztása, a gamer brand neve és
domainje (a Jira site URL-je lezárva: `https://kincsgoblin.atlassian.net`).

## Nem része (most)

Natív mobilapp · marketplace (külső eladók) · saját raktárkészlet-kezelés · többnyelvűség és több pénznem
(a 2. brandig) · B2B árazás.
