---
name: kg-babysit-pr
description: Egy KGoblin pull request követése CI-n és review-n át - a hibák javítása, a review-botok findingjainak elbírálása, naprakészen tartás a célággal (release/* vagy main). Használd, ha azt kérik, „figyeld a PR-t”, „babysit”, „kövesd a CI-t”, vagy a kg-full-stop 6. lépésében.
---

# kg-babysit-pr

Forrás: a BILDR HUB agent-kit `babysit-pr` skillje (t3dotgg/tstack, MIT), a KGoblin folyamatára igazítva.

## Várakozás

Saját polling- vagy `sleep`-ciklust ne írj. PR-onként egy watcher legyen:

- **T3 Code:** előbb kezeld a meglévő checkeket és kommenteket, aztán `watch_pull_request`, és zárd a turnt.
  A T3 felébreszt, ha egy check elbukik, a kötelezők zöldek, komment vagy review jön, vagy ütközés van.
  Csak az a thread watcholjon, amelyik a PR-t birtokolja; delegált gyerek-task soha. Átadás vagy kérdés
  előtt `unwatch_pull_request`.
- **Claude Code CLI:** a Monitor eszközzel futtasd: `gh pr checks <pr> --watch --fail-fast`.
- **Antigravity:** a terminálban `gh pr checks <pr> --watch --fail-fast`, utána `gh pr view <pr> --comments`.

Ha egy esemény nem igényel teendőt, zárd a turnt üzenet nélkül; ne írj „még várok”-at.

## Review-k és CI

- Csak a legutóbbi push utáni checkekkel és kommentekkel foglalkozz.
- Minden bot-findingot a forráskódon ellenőrizz, mielőtt módosítasz. A jogos hibát javítsd, a hamis
  pozitívra írj rövid, indokolt választ, és zárd le a szálat.
- Különböztesd meg a kód hibáját az infrastruktúra-flake-től (pl. Vercel build-kvóta, hálózati hiba); a
  flake-et írd le linkkel, és ne állítsd sikeresnek.
- A másik fejlesztő review-kommentje elsőbbséget élvez a botokkal szemben; vitás pontnál kérdezz.

## Méret

A PR maradjon akkora, amekkorát a cél kíván. A review-körök hajlamosak „olcsónak tűnő” javításokkal
hízni. Javítsd a valódi hibát a szándékolt esetben; a többit (felesleges teszt, lényegtelen peremeset,
plusz kompatibilitás, apró teljesítményköltség) írásos indokkal utasítsd el, és írd fel follow-upnak.

## Célág és merge

- Figyeld a célág (`release/*` vagy hotfixnél `main`) változását. Ha a PR BEHIND vagy DIRTY, a
  `kg-git-workflow` szerint merge-eld be a célágat, oldd fel az ütközést, futtasd újra az ellenőrzéseket.
  A T3 watcher csak az ütközést jelzi, a BEHIND állapotot neked kell megnézned.
- Merge csak kifejezett kérésre, a másik fejlesztő jóváhagyása és zöld CI mellett, squash-sal. Merge előtt
  `git fetch`, és nézd meg újra a PR-t. Ha egy átfedő PR feleslegessé teszi ezt, állj meg, és kérdezz,
  mielőtt lezárnád.
- Ha `gh` GraphQL-limitbe futsz: `gh api rate_limit --jq .resources.graphql`; REST-tel olvasd tovább
  (`gh api repos/Kincs-Goblin/KGoblin/pulls/<n>`).
