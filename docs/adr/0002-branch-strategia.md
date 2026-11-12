# ADR-0002: Branch-stratégia - release train, demo ág, Jira KG

- Állapot: elfogadott
- Dátum: 2026-11-12
- Döntéshozók: SMark2256, ricsmond12

## Kontextus

- Ketten dolgozunk, több AI agenttel párhuzamosan; a review-kapacitás a szűk keresztmetszet.
- Az ügyfélnek (vagy saját magunknak) összeállított demóra is szükség van, ami nem azonos az éles kóddal.
- Kiadás előtt a ticketeket együtt kell helyben tesztelni (több brand, Woo, jobok).
- Ticketkezelő: Jira, `KG` projektkulcs.

## Döntés

| Ág | Szerepe | Élettartama |
|---|---|---|
| `main` | Élesre kerülő kód | Tartós |
| `demo` | Ügyféltesztre összeállított változat | Tartós |
| ticketág `<típus>/KG-<n>-<leírás>` | Egy körülhatárolt feladat | A feladat beolvasztásáig |
| `release/ÉÉÉÉ-HH-NN` | Kiadás előtti helyi összetesztelés | Az adott kiadásig |
| `version/vX.Y.Z` | Verzió és release notes módosítása | A PR beolvasztásáig |
| `hotfix/KG-<n>-<leírás>` | Sürgős élesjavítás | A PR beolvasztásáig |
| `spike/KG-<n>-<leírás>` | Eldobható kísérlet | Eldobható |

- Ticketág friss `main`-ből, PR az aktív `release/*` ágba, squash.
- `version/*` a release-ágból, PR vissza a release-ágba, squash.
- `release/*` → `main` merge committal; ez a Vercel production deploy; utána `vX.Y.Z` tag.
- `demo`: csak merge (egyirányú), minden éles kiadás után reset a `main`-re (`--force-with-lease`, bejelentve).
- Hotfix: `main`-ből, PR a `main`-be, patch tag, majd a `main` merge-e a release-be és a demóba.
- Commit és PR-cím angolul (Conventional Commits, scope = ticketkulcs), a PR-leírás magyarul, AI-attribúció
  nélkül.
- Review: független AI review kockázati szint szerint + a másik fejlesztő jóváhagyása (CODEOWNERS).
- Szerepek: a két fejlesztő egyenrangú. A szerep PR-onként dől el (szerző és reviewer); ticketet, release-t,
  demót és hotfixet bárki vihet.

A végrehajtás részletei: `kg-git-workflow` és `kg-release` skill.

## Következmények

- A `main` mindig kiadott állapot; egy kiadás egy merge commit, könnyen visszakövethető.
- A release-ág közös integrációs pont: a ticketek ütközése ott derül ki, nem élesen.
- A demo eldobható, így kísérleti ticketek is felkerülhetnek rá anélkül, hogy a `main`-t szennyeznék.
- Kiadásonként több lépés (release-ág, version PR, release PR, tag); ezt a `kg-release` skill vezeti.
- Branch protection-t kézzel kell beállítani (`kg-git-workflow` → Branch protection).

## Mérlegelt alternatívák

| Alternatíva | Miért nem |
| ----------- | --------- |
| Ticket → main közvetlenül, release-ág csak fagyasztáskor | A `main` két kiadás között kiadásra nem kész kódot tartalmazna |
| Git Flow (develop + release + hotfix) | A `develop` és a `release` szerepe két főnél átfedne; a release train egyszerűbb |
| Demo mindig csak merge, reset nélkül | Az elvetett ticketek bent ragadnának |
| GitHub Issues / Linear | A csapat Jirát használ |
