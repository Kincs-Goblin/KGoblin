# ADR-0005: CI GitHub Actionsszel

- Állapot: elfogadott
- Dátum: 2026-11-12
- Döntéshozók: SMark2256, ricsmond12
- Ticket: KG-5

## Kontextus

- A Definition of Done szerint a quality gate (typecheck, lint, Steiger, teszt, build) helyben és a CI-ban
  is zöld; a `kg-babysit-pr` és a `kg-full-stop` CI-t feltételez. A KG-5 előtt nem volt CI-workflow, és a
  `kg-stack` sem rögzítette, mi futtassa.
- A repó GitHubon van, a PR-folyamat (`gh`, CODEOWNERS, PR-sablon) már erre épül.
- Az `apps/web` e2e-tesztje Playwrighttal fut; helyben a Windowsos headless Chromium párhuzamosan
  instabil volt, Linuxon ez nem jellemző.

## Döntés

GitHub Actions a CI. Egy workflow (`.github/workflows/ci.yml`) minden `main` és `release/**` célú PR-on és
pushon:

1. **Quality gate:** `pnpm install --frozen-lockfile`, Prettier-ellenőrzés, majd
   `pnpm turbo run typecheck lint test build` (a web lintje a Steigert is futtatja). A Node-verzió a
   `.nvmrc`-ből, a pnpm a `packageManager` mezőből jön.
2. **E2E:** a quality job build-kimenetével Playwright (Chromium) a `@kg/web` smoke-csomagra; hibánál a
   riport és a trace artifactként 7 napig elérhető.

A CI nem indít WordPress + WooCommerce példányt. A Woo-adatot igénylő tesztek MSW-vel, valódi (anonimizált)
Store API-válaszokból készült fixture-ökön futnak; a valódi Woo-próba helyben, a KG-4 Docker-környezetén
megy (`kg-dev-practices` 5/4).

## Következmények

- Minden PR-on látszik a quality gate és az e2e eredménye; a branch protectionben ez a két check lesz
  kötelező (külön beállítás a GitHubon, nem része ennek a PR-nak).
- Titok nem kell a workflow-hoz; ha később kell (pl. Vercel preview, Woo-kulcs), az GitHub Secretsbe kerül,
  és új env-kulcsként jelezzük a PR „Figyelni” részében.
- A Woo-val integrált CI-teszt (Docker Compose a runneren) később, külön ticketben jöhet.
- Frissítve: `kg-stack` (Eszközök és folyamat: CI sor).

## Mérlegelt alternatívák

| Alternatíva | Miért nem |
| ----------- | --------- |
| Csak Vercel build-ellenőrzés | Csak a buildet nézi, a tesztet, a lintet és a Steigert nem |
| GitLab CI / CircleCI | Új fiók és integráció; a repó és a PR-folyamat GitHubon van |
| Woo is a CI-ban (Docker Compose) | Lassú (WP-telepítés + seed minden futásnál); most az MSW-fixture elég, később külön ticket |
