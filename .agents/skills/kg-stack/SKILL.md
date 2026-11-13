---
name: kg-stack
description: A KGoblin stack egyetlen forrása - státuszos döntésnapló (elfogadva / javasolt / nyitott / felváltva) és a stack-változás kötelező folyamata. Használd, ha stackről kérdeznek, ha egy feladat új függőséget, szolgáltatást, hostingot, integrációt vagy adatfolyamot hozna be, ha egy meglévő döntést cserélnél, vagy ha egy nyitott döntést le kell zárni. Triggerek: „mit használunk X-re”, „bevezethetjük Y-t”, „cseréljük le”, „döntsük el”, „új csomag”, „új szolgáltatás”.
---

# kg-stack

Ez a fájl a projekt stackjének **egyetlen forrása**. Az `AGENTS.md` „Stack röviden” része ennek kivonata,
az ADR-ek (`docs/adr/`) pedig az indoklást őrzik. Ha a kettő eltér, ez a táblázat az irányadó, és az
eltérést ugyanabban a PR-ban javítani kell.

Státuszok: **elfogadva** (kötelező) · **javasolt** (alapértelmezés, de kérdés nélkül nem építünk rá
visszafordíthatatlanul) · **nyitott** (dönteni kell, mielőtt ráépül valami) · **felváltva** (történeti).

## Döntésnapló

Utolsó módosítás: 2026-11-13 (ADR-0008 WordPress hosting VPS + Docker Cloudflare mögött; ADR-0009
frontend Cloudflare Workersre, spike után).

### Architektúra és frontend

| Terület | Döntés | Státusz | ADR |
|---|---|---|---|
| Architektúra | Headless: Next.js storefront + WooCommerce backend | elfogadva | 0001 |
| Frontend | Next.js (App Router), React Server Components, TypeScript strict | elfogadva | 0001 |
| UI | Tailwind CSS + shadcn/ui, design tokenek CSS-változóként, brandenként | elfogadva | 0001 |
| UI-primitívek | Base UI (`@base-ui/react`) a shadcn/ui alatt (`base-nova` stílus), Radix helyett | elfogadva | 0004 |
| Animáció | Motion (`motion/react`) az egyetlen JS-animációs könyvtár; tokenek a `shared/ui/motion`-ben, `reducedMotion="user"`; egyszerű átmenet CSS-ből | elfogadva | 0004 |
| Fontok | `next/font/google`, build időben letöltve és saját domainről kiszolgálva; csak szabad licencű (OFL) font | elfogadva | 0004 |
| Kódszerkezet | FSD 3. szint (teljes) az `apps/web/src`-ben; Next-routing a `apps/web/app`-ban | elfogadva | 0001 |
| Multi-brand | Egy Next app; a domainből a proxy/middleware választ brandet (`[brand]` szegmens) | elfogadva | 0001 |
| Frontend hosting | Vercel (preview deploy PR-onként, production a `main`-ről); a spike sikeréig ez érvényes | elfogadva | 0001 |
| Frontend hosting (cél) | Cloudflare Workers + OpenNext (`@opennextjs/cloudflare`); spike (KG-118) után váltja a Vercelt | javasolt | 0009 |
| Edge, DNS, WAF | Cloudflare: DNS, TLS, WAF a backend előtt, Cloudflare Tunnel a VPS felé | elfogadva | 0008 |
| Szövegek, i18n | Elsőként magyar; szövegek slice-onként egy helyen, `next-intl` a 2. nyelvnél | javasolt | 0001 |
| Képek | Woo médiatár + `next/image`; CDN (Cloudflare R2 / Cloudinary) | nyitott | - |

### Commerce és adat

| Terület | Döntés | Státusz | ADR |
|---|---|---|---|
| Commerce motor | WooCommerce, HPOS bekapcsolva, Redis object cache | elfogadva | 0001 |
| Woo-példányok | Brandenként külön WP + Woo (külön készlet, rendelés, számlázás) | elfogadva | 0001 |
| Adatréteg | Store API: katalógus, kosár, checkout. REST v3 csak szerveroldalon (consumer key/secret) | elfogadva | 0001 |
| BFF | A böngésző nem hívja közvetlenül a WP-t: minden Woo-hívás a Next szerverén megy | elfogadva | 0001 |
| Validálás | Zod 4 minden Woo-válaszon és webhook-payloadon (`packages/woo-client`) | elfogadva | 0001 |
| Cache | ISR + `revalidateTag`; Woo webhook (`product.updated` stb.) → aláírt Next endpoint | elfogadva | 0001 |
| Auth | Woo customer az identitás + vendég checkout; token httpOnly, Secure, SameSite cookie-ban | elfogadva | 0001 |
| Auth plugin | Melyik WP JWT/headless auth plugin | nyitott | - |
| WordPress hosting | Saját VPS + Docker Compose (a lokális compose éles változata), Cloudflare mögött; brandenként `api.<domain>` | elfogadva | 0008 |
| VPS-szolgáltató | Melyik VPS-szolgáltató | nyitott | - |
| Demo/staging Woo | Külön demo-Woo brandenként, vagy közös staging | nyitott | - |

### Üzlet és integrációk

| Terület | Döntés | Státusz | ADR |
|---|---|---|---|
| Üzleti modell | Dropshipping: beszállítói feed → Woo termék; fizetett rendelés → beszállító | elfogadva | 0001 |
| Háttérjobok | Trigger.dev (`apps/jobs`): feed-szinkron, rendelés-továbbítás, újrapróba, ütemezés | elfogadva | 0001 |
| Beszállítók | Port + adapter + fake mintában, beszállítónként egy adapter | elfogadva | 0001 |
| Fizetés | Stripe, Barion, SimplePay a Woo gateway pluginjeivel, Store API checkouton át | elfogadva | 0001 |
| Számlázás | Billingo (NAV Online Számla) | elfogadva | 0001 |
| Számlázás bekötése | Woo Billingo plugin vagy Trigger.dev task a Billingo API-val | nyitott | - |
| Keresés | Meilisearch, brandenként külön index, jobokból és webhookból táplálva | elfogadva | 0001 |
| Keresés hosting | Meilisearch Cloud vagy saját | nyitott | - |
| Email | Resend + React Email; a Woo saját vásárlói emailjei kikapcsolva vagy felülírva | elfogadva | 0001 |
| Hibakövetés | Sentry (web + jobs) | elfogadva | 0001 |
| Analitika | PostHog | elfogadva | 0001 |
| Hirdetési tracking | Meta Conversions API (szerveroldali, `event_id`-dedup a pixellel) | elfogadva | 0001 |
| Termékfeed | Google Merchant Center feed brandenként | elfogadva | 0001 |

### Eszközök és folyamat

| Terület | Döntés | Státusz | ADR |
|---|---|---|---|
| Monorepo | pnpm workspaces + Turborepo, fix `packageManager` verzió | elfogadva | 0001 |
| Runtime | Node aktuális Active LTS (2026-11: Node 26), `.nvmrc`-ben | javasolt | 0001 |
| Lint, formázás | ESLint flat config + Prettier; Steiger az FSD-szabályokra | javasolt | 0001 |
| Tesztek | Vitest (unit, integráció), MSW a Woo-mockokhoz, Playwright (e2e) | javasolt | 0001 |
| CI | GitHub Actions (`.github/workflows/ci.yml`): quality gate + Playwright e2e minden `main`-re menő PR-on; Woo nélkül, MSW-fixture-ökkel | elfogadva | 0005 |
| Hibakódok | `DOMAIN.REASON` formátumú, katalógusban tartott hibakódok | javasolt | 0001 |
| Ticketek | Jira, `KG` kulcs | elfogadva | 0002, 0007 |
| Branch-folyamat | Tinati-alapú: `KG-<n>` → helyi release-teszt → PR a `demo`-ra → `demo` → `main` squash, `gh release` | elfogadva (2026-11-13, felváltja: 0002) | 0007 |
| AI agentek | Agent-független: `AGENTS.md` és `.agents/skills/` a közös forrás, bármelyik eszköz használható; eszközfüggő részlet csak a `docs/process/agent-adapters.md`-ben | elfogadva | 0003, 0006 |

## Stack-változás folyamata (kötelező)

### Mi számít stack-változásnak

- új külső szolgáltatás vagy SaaS (fizetés, email, kereső, CDN, hosting, monitorozás);
- új könyvtár-**kategória** (állapotkezelő, form-könyvtár, ORM, UI-kit, dátumkönyvtár), vagy egy meglévő
  cseréje;
- egy táblázatbeli döntés cseréje vagy egy nyitott döntés lezárása;
- új adatfolyam vagy integráció (új webhook, új beszállító-típus, új Woo plugin, ami API-t ad);
- a Next.js, a WooCommerce, a Node vagy a Trigger.dev **major** verzióváltása;
- FSD-szint vagy rétegszabály módosítása.

Nem stack-változás: patch- és minor-frissítés, egy már elfogadott kategórián belüli kisegítő csomag (pl. egy
shadcn-komponens hozzáadása), belső refaktor.

### Lépések

1. **Állj meg.** Ne vezesd be csendben. Mondd el, mi a probléma, és miért nem elég a jelenlegi stack.
2. **Kérdezz** opciós kérdéssel: 2-4 opció, a javasolt elöl „(Javasolt)” jelöléssel, mindegyiknél a
   trade-off (költség, lock-in, karbantartás, kompatibilitás a meglévő döntésekkel).
3. **Rögzítsd** a döntést ugyanabban a PR-ban, amelyik bevezeti (vagy egy előtte álló `docs/KG-n-…` PR-ban):
   - új ADR: `docs/adr/NNNN-<kebab-cim>.md` a `0000-sablon.md` alapján, a következő szabad számmal;
   - ebben a fájlban: a sor frissítése (döntés, státusz, ADR-szám) és a fenti „Utolsó módosítás” sor;
   - felváltott döntés: a régi ADR állapota `felváltva (ADR-NNNN)`, a tartalmát nem töröljük;
   - `AGENTS.md` „Stack röviden”, ha az érinti;
   - minden skill, amelyik a régi döntésre hivatkozik (`grep -ri "<régi név>" .agents AGENTS.md docs`).
4. **PR**: a PR-leírás „Stack-változás” jelölőnégyzete legyen kipipálva, az ADR linkelve. A merge-hez adott
   „mehet” (bármelyik fejlesztőé) itt a döntés jóváhagyása is.

### Nyitott döntés lezárása

Ha egy feladat nyitott döntésre épülne (pl. VPS-szolgáltató), ne válassz a felhasználó helyett. Tedd fel
a kérdést; amíg nincs döntés, olyan megoldást válassz, amelyik nem zárja ki egyik opciót sem, és ezt mondd ki.

## Amit ne csinálj

- Ne telepíts olyan csomagot vagy szolgáltatást, ami nincs a táblázatban, a fenti folyamat nélkül.
- Ne írd át egy döntés státuszát „elfogadva”-ra emberi döntés nélkül.
- Ne törölj ADR-t; a felváltás a történet része.
- Ne köss be külső rendszert (fiók, API-kulcs, webhook-regisztráció) kérés nélkül; a döntés rögzítése
  nem jelent bekötést.
