---
name: kg-babysit-pr
description: Egy KGoblin pull request követése CI-n és review-n át - a hibák javítása, a review-botok findingjainak elbírálása, naprakészen tartás a célággal (release/* vagy main). Használd, ha azt kérik, „figyeld a PR-t”, „babysit”, „kövesd a CI-t”, vagy a kg-full-stop 6. lépésében.
---

# kg-babysit-pr

Forrás: a BILDR HUB agent-kit `babysit-pr` skillje (t3dotgg/tstack, MIT), a KGoblin folyamatára igazítva.

## Várakozás

Saját polling- vagy `sleep`-ciklust ne írj. PR-onként egy watcher legyen:

- Előbb kezeld a meglévő checkeket és kommenteket, utána indítsd a watchert.
- Ha az eszközödnek van PR-figyelője, azt használd; ha nincs, `gh pr checks <pr> --watch --fail-fast`, utána
  `gh pr view <pr> --comments`. Eszközönként: `docs/process/agent-adapters.md`.
- Csak az a session watcholjon, amelyik a PR-t birtokolja; delegált gyerek-task soha. Átadás vagy kérdés
  előtt állítsd le a watchert.

Ha egy esemény nem igényel teendőt, zárd a turnt üzenet nélkül; ne írj „még várok”-at.

## Review-k és CI

- A PR-t a szerzője, vagyis a ticket felelőse követi és javítja; a review-findingok kezelése nem kerül át a
  reviewerre (`kg-ticket-to-pr` → Felelősség).
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
  A watcherek jellemzően csak az ütközést jelzik, a BEHIND állapotot neked kell megnézned.
- Merge csak bármelyik fejlesztő kifejezett „mehet”-jére, zöld CI és lezárt review-ciklus mellett, squash-sal. Merge előtt
  `git fetch`, és nézd meg újra a PR-t. Ha egy átfedő PR feleslegessé teszi ezt, állj meg, és kérdezz,
  mielőtt lezárnád.
- Ha `gh` GraphQL-limitbe futsz: `gh api rate_limit --jq .resources.graphql`; REST-tel olvasd tovább
  (`gh api repos/Kincs-Goblin/KGoblin/pulls/<n>`).
