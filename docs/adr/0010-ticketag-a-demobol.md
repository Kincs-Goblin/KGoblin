# ADR-0010: A ticketág a `demo`-ból indul

- Állapot: elfogadott
- Dátum: 2026-11-13
- Döntéshozók: SMark2256, ricsmond12
- Ticket: KG-117
- Részben felváltja: ADR-0007 (a táblázat „Honnan” oszlopa a `KG-<n>`, a `release/*` és a `refactor/*` sorban)

## Kontextus

- Az ADR-0007 szerint a ticketág, a `refactor/*` ág és a helyi `release/ÉÉÉÉ-HH-NN` tesztág friss
  `origin/main`-ből indul; a még nem élesített ticketre épülő munka az alap ticket ágából.
- Az élesítés egyetlen `demo` → `main` squash PR, ami mindent kivisz, ami a demón van. A demón lévő ticketet
  így sem lehet kihagyni a kiadásból, csak revertálni vagy javítani; a `demo` tehát a tényleges
  integrációs alap.
- Gyakorlati példa: a KG-6 (`vercel.json`, env-sémák) a `demo`-n van, a `main`-en nincs. A `main`-ből induló
  ticket ezt nem látja, és a helyi teszt sem azt az állapotot nézi, ami kimegy.

## Döntés

| Ág | Honnan (új) |
|---|---|
| `KG-<n>` (ticket) | friss `origin/demo`, vagy az alap ticket ága |
| `refactor/<terület>-…` | friss `origin/demo` |
| `release/ÉÉÉÉ-HH-NN` (helyi tesztág) | `origin/demo` |
| `KG-<n>` (hotfix) | friss `origin/main` (változatlan) |

- Ha egy kiadás vagy hotfix után a `main` előrébb jár, mint a `demo`, az új ticketág indítása előtt a
  `main` → `demo` szinkron PR megy (`git merge-base --is-ancestor origin/main origin/demo`).
- Ha a ticketág a `demo` PR-nál ütközik, a ticketágba az `origin/demo` merge-elendő (vagy az alap ticket ága).
- A ticket-folyamat a `demo`-ra történő merge-nél véget ér. A `version/*` PR és a `demo` → `main` élesítés
  csak külön kérésre indul (`kg-release`), nem ticketenként.
- A többi ADR-0007-szabály (merge-stratégiák, CI csak a `main` PR-okon, hotfix-út, szinkron PR) változatlan.

## Következmények

- A ticket látja és használhatja a még nem élesített munkát; kevesebb az ütközés a `demo` PR-nál, és a helyi
  release-teszt azt az állapotot nézi, ami kimegy.
- A `demo` PR-okon 2026-11-14-ig nem volt CI (azóta van, ADR-0011): ami hibásan került a demóra, azt
  minden ráépülő ticketág megörökli. Ez eddig is kiment volna vele; most korábban kiderül. A javítás
  továbbra is a hibás ticket ágán, új committal történik.
- A quality gate változás-szűrője és a review base `origin/demo` lett.
- Frissítve: `kg-git-workflow`, `kg-ticket-to-pr` (és a `.claude` mutató leírása), `kg-release`,
  `kg-full-stop`, `.agents/workflows/ticket.md` és `release-cut.md`, `docs/process/agent-adapters.md`,
  `AGENTS.md` „Git röviden”, `kg-stack` „Branch-folyamat” sora, ADR-0007 állapota.

## Mérlegelt alternatívák

| Alternatíva | Miért nem |
| ----------- | --------- |
| Marad az `origin/main` (ADR-0007) | A ticket nem látja a demón lévő, úgyis kimenő munkát; ráépülésnél ticketágak láncolása kell |
| A hotfix is a `demo`-ból | A demón teszt alatt álló kód lehet, ami nem mehet ki egy sürgős javítással |
