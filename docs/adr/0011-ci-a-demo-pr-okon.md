# ADR-0011: CI a `demo`-ra menő PR-okon is

- Állapot: elfogadott
- Dátum: 2026-11-14
- Döntéshozók: SMark2256, ricsmond12
- Ticket: KG-120
- Felváltja: az ADR-0007 „CI csak a `main`-re menő PR-okon” pontját és az ADR-0005 trigger-szűkítését

## Kontextus

- Az ADR-0007 szerint a CI csak a `main`-re menő PR-okon és a `main` pushán futott; a `demo` PR-ok kapuja a
  helyi release-teszt volt.
- Az ADR-0010 óta a ticketágak a `demo`-ból indulnak: ami hibásan kerül a demóra, azt minden ráépülő
  ticketág megörökli, és csak a `demo` → `main` kiadásnál bukna ki a CI-n.
- A KG-119 óta a `demo` ágról a Cloudflare Workers demo is automatikusan buildel és deployol; a demóra
  került hiba azonnal az ügyfél elé kerül.

## Döntés

- A `.github/workflows/ci.yml` a `main` és a `demo` célú PR-okon, valamint a `main` és a `demo` pushán fut
  (quality gate + Playwright e2e, ugyanazokkal a jobokkal).
- A `demo` PR merge-kapuja: zöld CI + lezárt review-ciklus + bármelyik fejlesztő kifejezett „mehet”-je.
- A helyi release-teszt megmarad: több ticket együttes próbája a `demo` PR-ok előtt (`kg-release` 1-3.); a
  CI nem helyettesíti, és fordítva.

## Következmények

- A demóra csak zöld CI-vel kerül kód; a ticketágak tesztelt alapból indulnak.
- Több GitHub Actions-perc: minden `demo` PR és `demo` push lefuttatja a teljes CI-t.
- A `demo` branch protectionjében a `Quality gate` és az `E2E (Playwright)` kötelező status check lesz; a
  GitHub-beállítás a KG-23 része.
- Frissítve: `ci.yml`, ADR-0005 és ADR-0007 állapota, `kg-stack` (CI sor), `AGENTS.md` (merge-kapu,
  Parancsok), `kg-git-workflow`, `kg-ticket-to-pr`, `kg-release`, `docs/process/infrastructure.md`.

## Mérlegelt alternatívák

| Alternatíva | Miért nem |
| ----------- | --------- |
| Marad a helyi release-teszt mint egyetlen kapu | A hiba a demóra és minden ráépülő ágba továbbmegy, mire a `main` PR CI-je kiszűri |
| Csak quality gate a `demo` PR-on, e2e nélkül | Kevesebb perc, de a brandválasztás és az oldalak smoke-tesztje épp a demón számít |
