# ADR-0001: Kezdő stack - headless Next.js + brandenkénti WooCommerce, dropshipping

- Állapot: elfogadott; a frontend hosting (Vercel) felváltva: ADR-0009 (Cloudflare Workers)
- Dátum: 2026-11-12
- Döntéshozók: SMark2256, ricsmond12

## Kontextus

- WooCommerce-alapú webshopot építünk, első körben gamer tematikával, később további niche-shopokkal
  ugyanarra a kódbázisra.
- Üzleti modell: dropshipping. A termékek és a készlet beszállítói feedből jönnek, a fizetett rendelés a
  beszállítóhoz megy tovább.
- Ketten fejlesztünk, AI agentekkel (Claude Code, Antigravity). A webshopnál a SEO kritikus, a hirdetési
  tracking a dropshipping miatt szinte kötelező, a magyar vásárlók a hazai fizetési módokat is várják.
- A repóban lévő klasszikus WP-témás prototípus nem alap; a döntés ettől függetlenül született.

## Döntés

| Terület | Választás |
|---|---|
| Architektúra | Headless: Next.js (App Router, TypeScript) frontend Vercelen (a hosting felváltva: ADR-0009, Cloudflare Workers), WooCommerce backend |
| Multi-brand | Egy Next app, a domainből a proxy választ brandet; brandenként külön WP + Woo példány |
| Adatréteg | Store API (katalógus, kosár, checkout), REST v3 csak szerveroldalon; BFF, a böngésző nem hívja a WP-t; Zod minden válaszon |
| Cache | ISR + `revalidateTag`, aláírt Woo webhookkal |
| Kódszerkezet | FSD 3. szint az `apps/web/src`-ben; monorepo pnpm + Turborepo |
| UI | Tailwind + shadcn/ui, brandenkénti design tokenek |
| Auth | Woo customer + vendég checkout, token httpOnly cookie-ban |
| Háttérjobok | Trigger.dev: feed-szinkron, rendelés-továbbítás, email, számla, CAPI |
| Fizetés | Stripe, Barion, SimplePay a Woo gateway pluginjeivel |
| Számlázás | Billingo |
| Keresés | Meilisearch, index brandenként |
| Email | Resend + React Email |
| Mérés | Sentry, PostHog, Meta Conversions API, Google Merchant Center feed |
| Javasolt (még nem kötelező) | Node aktuális LTS, ESLint + Prettier + Steiger, Vitest + MSW + Playwright, `DOMAIN.REASON` hibakódok, `next-intl` a 2. nyelvnél |
| Nyitott | WordPress hosting, demo/staging Woo, auth plugin, Billingo-bekötés módja, Meilisearch hosting, kép-CDN |

## Következmények

- A Woo marad a kereskedelmi logika forrása (ár, adó, kupon, készlet, rendelés); a frontend nem számol.
- Brandenként külön Woo: tiszta elkülönítés (készlet, rendelés, számlázás), de több üzemeltetés. A
  plugin-lista és -verzió közös, a frissítéshez runbook kell.
- Az FSD 3. szint több mappát jelent az elején, cserébe 4+ domain mellett is kezelhető marad a kód.
- A gateway pluginek Store API-támogatását korán ellenőrizni kell (spike).
- A döntésnapló a `kg-stack` skillben él; minden későbbi változás új ADR + `kg-stack` frissítés.

## Mérlegelt alternatívák

| Alternatíva | Miért nem |
| ----------- | --------- |
| Klasszikus WP-téma (PHP + Tailwind) | Kevésbé rugalmas UI, nehezebb multi-brand, gyengébb DX az agentes munkához |
| Hibrid (Next katalógus + natív Woo checkout) | Két UI-réteg, két arculat-karbantartás; a fizetés így is plugin-alapú marad |
| Medusa.js v2 saját commerce-motorral | A követelmény WooCommerce-összekötés; a Woo admin és pluginökoszisztéma (Billingo, gatewayek) kész |
| WPGraphQL + WooGraphQL | Külső fejlesztésű plugin, a Woo-frissítéseket késve követheti |
| Egy Woo, kategóriával szétválasztva | Közös rendelés és számlázás a brandek között, nehezebb elkülönítés |
| WP Multisite | A Woo + Multisite párosnak ismert buktatói vannak |
| Különálló Next app brandenként | Több deploy és karbantartás, kódmásolási kísértés |
| Inngest / WP Action Scheduler | Inngestnél a hosszú feed-importot lépésekre kell bontani; az Action Scheduler brandenként duplikált PHP-logika |
| Better Auth + saját DB | Két identitás szinkronban tartása; most nincs rá szükség |
| Számlázz.hu | A Billingo modern REST API-ja jobban illik a job-alapú bekötéshez |
