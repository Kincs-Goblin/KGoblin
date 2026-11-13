# Fejlesztési infrastruktúra: CI, Branch Protection, Vercel és Trigger.dev

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

## 3. Vercel Projekt (`apps/web`)

### Projekt-beállítások
- **Root Directory:** `apps/web`
- **Konfiguráció a repóban:** `apps/web/vercel.json`
  - `installCommand`: `pnpm install --frozen-lockfile`
  - `buildCommand`: `pnpm turbo run build --filter=@kg/web...`
  - `ignoreCommand`: `npx turbo-ignore@2.11.11 @kg/web` (csak akkor épít, ha a `@kg/web` vagy a workspace-függőségei változtak)
- **Git-ágak:**
  - **Production Branch:** `main`
  - **Demo környezet:** a `demo` ág branch-deploya (saját demo-domainnel brandenként, pl. `demo.<gamer-domain>.hu`)
  - **Preview deploy:** minden PR-hoz automatikus preview URL készül, amely megjelenik a PR kommentjében/checkjében.
- **Keresőmotor-tiltás (`noindex`):**
  - Ha `NEXT_PUBLIC_APP_ENV=preview`, `NEXT_PUBLIC_APP_ENV=demo` vagy `VERCEL_ENV=preview`, a `next.config.ts` `headers()` konfigurációja automatikusan `X-Robots-Tag: noindex, nofollow` HTTP fejlécet ad minden válaszra.

### Környezeti változók (Vercel)

| Változó | Típus | Preview | Demo (`demo` ág) | Production (`main`) | Leírás |
|---|---|---|---|---|---|
| `NEXT_PUBLIC_APP_ENV` | Kliens + Szerver | `preview` | `demo` | `production` | Környezet azonosító (`noindex` szabályozás) |
| `KG_STORE_FIXTURES` | Szerver | `1` (ha nincs staging Woo) | `0` | `0` | `1`: Store API fixture-ök használata; `0`: élő Woo |
| `WOO_GAMER_URL` | Szerver | Demo/Staging Woo URL | Demo Woo URL | Éles Gamer Woo URL | A Gamer brand WooCommerce alap URL-je |
| `WOO_GAMER_CONSUMER_KEY` | Szerver (Secret) | Teszt REST v3 kulcs | Demo REST v3 kulcs | Éles REST v3 kulcs | Woo REST v3 consumer key (`server-only`) |
| `WOO_GAMER_CONSUMER_SECRET` | Szerver (Secret) | Teszt REST v3 titok | Demo REST v3 titok | Éles REST v3 titok | Woo REST v3 consumer secret (`server-only`) |
| `WOO_GAMER_WEBHOOK_SECRET` | Szerver (Secret) | Teszt webhook titok | Demo webhook titok | Éles webhook titok | Webhook HMAC-SHA256 aláírás-ellenőrző kulcs |
| `NEXT_PUBLIC_SENTRY_DSN` | Kliens + Szerver | Opcionális | Sentry DSN | Sentry DSN | Sentry hibakövetés publikus DSN (M5) |

---

## 4. Trigger.dev Projekt (`apps/jobs`)

### Konfiguráció
- **Konfigurációs fájl:** `apps/jobs/trigger.config.ts` (`project: "proj_kgoblin"` - az első `trigger dev` vagy `trigger deploy` előtt a Trigger.dev projekt valódi `proj_...` azonosítójára cserélendő; nem titok, a konfigurációban tároljuk)
- **Taskok és életciklus-hookok helye:** `apps/jobs/src/trigger/`
- **Minta task:** `brand-heartbeat` (`apps/jobs/src/trigger/brand-heartbeat.ts`), amely `brand-heartbeat:<brand>:<correlationId>` idempotencia-kulccsal és brand-validációval fut.
- **Hibajelentés:** a `src/trigger/init.ts` `tasks.onFailure` hookja a `src/adapters/telemetry.ts` `reportTaskFailure` függvényét hívja, amely PII-mentesen (csak `taskId`, `runId`, `brandId`, `code`, `retryable`) naplóz, és előkészíti a Sentry-bekötést (KG-88).

### Környezeti változók (Trigger.dev)

| Változó | Típus | Dev | Staging / Demo | Production | Leírás |
|---|---|---|---|---|---|
| `TRIGGER_SECRET_KEY` | Secret | `tr_dev_...` | `tr_stg_...` | `tr_prod_...` | Trigger.dev API kulcs (lokális `.env.local` / CI) |
| `SENTRY_DSN` | Konfig | Opcionális | Sentry DSN | Sentry DSN | Sentry DSN a háttérjobokhoz |
| `WOO_GAMER_URL` | Konfig | `http://localhost:8080` | Demo Woo URL | Éles Woo URL | Gamer WooCommerce példány URL-je |
| `WOO_GAMER_CONSUMER_KEY` | Secret | Lokális kulcs | Demo kulcs | Éles kulcs | Woo REST v3 consumer key |
| `WOO_GAMER_CONSUMER_SECRET` | Secret | Lokális titok | Demo titok | Éles titok | Woo REST v3 consumer secret |
| `WOO_GAMER_WEBHOOK_SECRET` | Secret | Lokális titok | Demo titok | Éles titok | Webhook titok |
