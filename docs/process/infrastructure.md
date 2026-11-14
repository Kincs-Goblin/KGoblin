# Fejlesztési infrastruktúra: CI, Branch Protection, Cloudflare Workers és Trigger.dev

Ez a dokumentum a `KG-6` (0. mérföldkő) infrastruktúra-beállításait és a környezeti változók jegyzékét tartalmazza az ADR-0005 és az ADR-0007 (demo-alapú kiadás) szerint.

---

## 1. CI (GitHub Actions – `.github/workflows/ci.yml`)

- **Mikor fut:** minden `main` célú Pull Requesten (`demo` → `main` kiadás, `KG-<n>` hotfix → `main`), a `main` pushán, valamint kézi indítással (`workflow_dispatch`).
- **A `demo` PR-ok kapuja:** a helyi release-teszt (`kg-release` 1-3. lépés), amelynek eredményét a PR leírásának „Ellenőrzés” blokkjában rögzítjük.
- **Jobok:**
  1. `Quality gate`: `pnpm install --frozen-lockfile` (pnpm store cache-sel), `pnpm format:check`, majd `pnpm turbo run typecheck lint test build` (benne az ESLint, a Steiger FSD-ellenőrzés és a Vitest unit-tesztek minden csomagra, beleértve a `@kg/web` és `@kg/jobs` alkalmazásokat).
  2. `E2E (Playwright)`: a `Quality gate` által épített `.next` artifactból futtatja a Chromium smoke teszteket (desktop + mobil). Hibánál a `playwright-report` és `test-results` 7 napig artifactként elérhető.

---

## 2. Branch Protection (GitHub Settings → Branches)

Az ADR-0007 és a `kg-git-workflow` szerint a GitHubon beállítandó szabályok:

| Ág | Kötelező PR | Kötelező jóváhagyás | Kötelező status checkek | Force push és törlés | Merge módok |
|---|---|---|---|---|---|
| `main` | Igen | `0` (a kapu bármelyik fejlesztő „mehet”-je, a GitHub pedig a saját PR jóváhagyását nem engedi) | `Quality gate`, `E2E (Playwright)` | Tiltva | Squash (`demo` → `main`, hotfix → `main`) |
| `demo` | Igen | `0` | Nincs (helyi release-teszt a kapu) | Tiltva | Merge commit (`KG-<n>` → `demo`, `version/*` → `demo`, `main` → `demo`) |

---

## 3. Cloudflare Workers (`apps/web`, ADR-0009)

### Konfiguráció
- **A repóban:** `apps/web/wrangler.jsonc` (Worker, bindingok, futásidejű nem titkos változók) és `apps/web/open-next.config.ts` (OpenNext: KV incremental cache, D1 tag cache, Durable Object revalidálási sor).
- **Bindingok:** `NEXT_INC_CACHE_KV` (KV), `NEXT_TAG_CACHE_D1` (D1, `revalidations` tábla), `NEXT_CACHE_DO_QUEUE` (Durable Object), `IMAGES` (Cloudflare Images a `next/image`-hez), `WORKER_SELF_REFERENCE`, `ASSETS`.
- **Scriptek:** `pnpm --filter @kg/web build:cf` (OpenNext build), `preview:cf` (helyi workerd), `deploy:cf`. Windowson az OpenNext build symlinkek miatt csak Developer Mode-dal vagy WSL-ben fut; a napi fejlesztés (`pnpm dev`) nem érintett.

### Workers Builds (Cloudflare dashboard → Worker → Settings → Build)
- **Repó:** `Kincs-Goblin/KGoblin`, Root directory: `/`.
- **Build command:** `pnpm --filter @kg/web build:cf` · **Deploy command:** `pnpm --filter @kg/web deploy:cf`.
- **Build-változók:** `NODE_VERSION=26.13.0`, `PNPM_VERSION=12.16.1`, plusz a build időben olvasott `NEXT_PUBLIC_APP_ENV` és `KG_STORE_FIXTURES` (lásd a táblázatot).
- **Környezetek:**
  - **Demo:** a `kincsgoblin` Worker a `demo` ágról, `https://kincsgoblin.devdemos.workers.dev` (egyelőre a személyes fiókon).
  - **Production:** a `main`-ről, saját domainnel a KGoblin-fiókon - külön ticket.
  - **PR-preview:** most nincs; a preview-hostokat a `proxy.ts` nem ismeri (fail-closed 404), brand-host stratégia kell hozzá.
- **Keresőmotor-tiltás (`noindex`):** ha `NEXT_PUBLIC_APP_ENV=preview` vagy `demo`, a `next.config.ts` `headers()` konfigurációja `X-Robots-Tag: noindex, nofollow` fejlécet ad minden válaszra.
- **Titkok:** Worker-secretként (`wrangler secret put` vagy dashboard → Variables and Secrets), soha nem a `wrangler.jsonc`-be.

### Környezeti változók (Cloudflare Workers)

| Változó | Típus | Preview (később) | Demo (`demo` ág) | Production (`main`) | Leírás |
|---|---|---|---|---|---|
| `NEXT_PUBLIC_APP_ENV` | Kliens + Szerver (build és futás) | `preview` | `demo` | `production` | Környezet azonosító (`noindex` szabályozás) |
| `KG_STORE_FIXTURES` | Szerver (build és futás) | `1` (ha nincs staging Woo) | `1`, amíg nincs demo-Woo, utána `0` | `0` | `1`: Store API fixture-ök használata; `0`: élő Woo |
| `WOO_GAMER_URL` | Szerver | Demo/Staging Woo URL | Demo Woo URL | Éles Gamer Woo URL | A Gamer brand WooCommerce alap URL-je |
| `WOO_GAMER_CONSUMER_KEY` | Szerver (Secret) | Teszt REST v3 kulcs | Demo REST v3 kulcs | Éles REST v3 kulcs | Woo REST v3 consumer key (`server-only`) |
| `WOO_GAMER_CONSUMER_SECRET` | Szerver (Secret) | Teszt REST v3 titok | Demo REST v3 titok | Éles REST v3 titok | Woo REST v3 consumer secret (`server-only`) |
| `WOO_GAMER_WEBHOOK_SECRET` | Szerver (Secret) | Teszt webhook titok | Demo webhook titok | Éles webhook titok | Webhook HMAC-SHA256 aláírás-ellenőrző kulcs |
| `TRIGGER_SECRET_KEY` | Szerver (Secret) | `tr_dev_...` | `tr_stg_...` | `tr_prod_...` | Trigger.dev API kulcs a háttérjobok indításához (`server-only`) |
| `NEXT_PUBLIC_SENTRY_DSN` | Kliens + Szerver | Opcionális | Sentry DSN | Sentry DSN | Sentry hibakövetés publikus DSN (M5) |

---

## 4. Trigger.dev Projekt (`apps/jobs`)

### Konfiguráció
- **Konfigurációs fájl:** `apps/jobs/trigger.config.ts` (`project: "proj_kgoblin"` - az első `trigger dev` vagy `trigger deploy` előtt a Trigger.dev projekt valódi `proj_...` azonosítójára cserélendő; nem titok, a konfigurációban tároljuk)
- **Taskok és életciklus-hookok helye:** `apps/jobs/src/trigger/`
- **Minta task:** `brand-heartbeat` (`apps/jobs/src/trigger/brand-heartbeat.ts`), amely `brand-heartbeat:<brand>:<correlationId>` idempotencia-kulccsal és brand-validációval fut.
- **Hibajelentés:** a `src/trigger/init.ts` `tasks.onFailure` hookja a `src/adapters/telemetry.ts` `reportTaskFailure` függvényét hívja, amely PII-mentesen (csak `taskId`, `runId`, `brandId`, `code`, `retryable`) naplóz, és előkészíti a Sentry-bekötést (KG-88).

### Környezeti változók (`@kg/jobs` és Trigger.dev Cloud)

| Változó | Hol állítjuk be | Dev | Staging / Demo | Production | Leírás |
|---|---|---|---|---|---|
| `TRIGGER_SECRET_KEY` | Lokális `.env.local` | `tr_dev_...` | - | - | Lokális `trigger dev` futtatáshoz (felhőben a Trigger.dev automatikusan injektálja; CI deployhoz `TRIGGER_ACCESS_TOKEN` használható) |
| `SENTRY_DSN` | Trigger.dev Cloud + `.env.local` | Opcionális | Sentry DSN | Sentry DSN | Sentry DSN a háttérjobokhoz |
| `WOO_GAMER_URL` | Trigger.dev Cloud + `.env.local` | `http://localhost:8080` | Demo Woo URL | Éles Woo URL | Gamer WooCommerce példány URL-je |
| `WOO_GAMER_CONSUMER_KEY` | Trigger.dev Cloud (Secret) + `.env.local` | Lokális kulcs | Demo kulcs | Éles kulcs | Woo REST v3 consumer key |
| `WOO_GAMER_CONSUMER_SECRET` | Trigger.dev Cloud (Secret) + `.env.local` | Lokális titok | Demo titok | Éles titok | Woo REST v3 consumer secret |
