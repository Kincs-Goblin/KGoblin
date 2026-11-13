---
name: kg-release
description: A KGoblin kiadási folyamata - helyi release/ÉÉÉÉ-HH-NN tesztág, teljes ellenőrzés, kiadási commit version/vX.Y.Z PR-ral a demóra, ticket PR-ok a demóra, demo → main squash PR, gh release, élő ellenőrzés, revert, hotfix kiadás, SemVer-szabályok. Használd, ha release-t, kiadást, verzióemelést, demót, prod deployt vagy hotfixkiadást kérnek, vagy ha azt kérdezik, „mi megy ki a következő kiadásban”.
---

# kg-release

Minden lépés **csak kifejezett kérésre** indul, és egy korábbi jóváhagyás nem vonatkozik a következő lépésre.
Az ágak szabályai a `kg-git-workflow` skillben vannak, a döntés az ADR-0007-ben.

A kiadást bármelyik fejlesztő viheti, nincs kijelölt release-felelős. Minden PR-ra a merge-kapu érvényes
(`AGENTS.md`: zöld CI, ahol fut, lezárt review-ciklus és bármelyik fejlesztő kifejezett „mehet”-je).
Ritmus: 1-2 naponta, vagy amikor van kész ticket.

## Verziózás (SemVer)

- Verzió: `vX.Y.Z`, a gyökér `package.json` `version` mezőjével és a `CHANGELOG.md` legfelső szakaszával
  egyezik.
- **Indulás előtt** `0.Y.Z`: új funkció → `Y`, csak javítás → `Z`.
- **`v1.0.0`** az első brand (gamer) nyilvános indulása; ezt csak kifejezett kérésre emeled.
- **Indulás után:** a kiadás egészéből döntesz. Új funkció a vásárlónak vagy a shop-adminnak → minor;
  csak javítás, szöveg, finomhangolás → patch; vásárlói fiókot, URL-szerkezetet (SEO) vagy integrációs
  szerződést törő változás → major, kizárólag kérésre.
- Hotfix mindig patch. Technikai refaktor vagy dokumentáció önmagában nem kiadás. Kiadott verzió tartalma nem
  változik; a javítás új verzió.

## 1. Helyi release-tesztág

```bash
git fetch origin
git switch -c release/2026-11-26 origin/demo            # csak helyben, nem pusholjuk
git merge --no-ff origin/KG-12                           # ticketenként, az alap ticket a ráépülő előtt
git merge --no-ff origin/KG-15
```

- A dátum a tervezett kiadás napja. A ticketágakat a szerzőjük pusholja; a release-ág nem megy fel.
- Ha a `demo`-ból hiányzik a `main` friss állapota, előbb a `main` → `demo` szinkron PR (`kg-git-workflow`).

## 2. Kiadási commit

1. Válaszd ki a verziót a fenti szabályok szerint: a tartalmi különbség `git diff --stat origin/main HEAD`, a
   ticketlista az utolsó kiadás óta a demóra merge-elt PR-okból (`gh pr list --base demo --state merged`) és a
   release-ág `--no-ff` merge-eiből. A `git log origin/main..HEAD` a squash miatt a korábbi kiadások
   commitjait is listázná. Javasold, és kérdezz rá.
2. A release-ágon: a gyökér `package.json` `version` mezője, és a `CHANGELOG.md` új szakasza magyarul,
   felhasználói nyelven: `## [0.3.0] - 2026-11-26` → Új · Fejlesztés · Javítás · Belső (ticketkulccsal).
3. Commit: `chore(release): v0.3.0`.

## 3. Helyi teszt

- A release-ág fáján: `pnpm turbo run typecheck lint test build`, `pnpm --filter @kg/web test:e2e`, és kézi
  teszt a helyi appban a fő vásárlói úton (főoldal → kategória → termék → kosár → checkout teszt-gatewayjel →
  visszaigazolás), **minden érintett brandre**.
- Ha volt Woo plugin-, webhook- vagy job-változás: a lokális Docker-Woo-n valódi rendelés, és nézd meg, mi
  keletkezett (rendelés, beszállítói továbbítás a fake adapterrel, email, Billingo sandbox).
- A hibát a ticketág javítja, utána újra merge-eled a release-ágba. Közvetlenül a release-ágon csak a kiadási
  commit készül.
- Az eredmény (parancs → eredmény, mi nincs kipróbálva) kerül a demo PR-ok „Ellenőrzés” részébe.

## 4. Demo PR-ok

```bash
gh pr create --base demo --head KG-12 --title "feat(KG-12): ..."      # ticketenként, merge committal
git switch -c version/v0.3.0 origin/demo --no-track                # a ticket PR-ok merge-e után
git cherry-pick <a release-ág chore(release) commitja>
git push -u origin version/v0.3.0
gh pr create --base demo --head version/v0.3.0 --title "chore(release): v0.3.0"
```

- Sorrend: az alap ticket a ráépülő előtt, a `version/*` PR utoljára. Mind **merge commit**. A `version/*`
  ág csak a kiadási commitot viszi; a release-ágról közvetlenül ne ágaztasd el, mert minden helyi merge-et
  magával vinne.
- A `demo` PR-okon nincs CI; a kapu a 3. lépés helyi tesztje.
- A merge után a demo környezet a `demo` ágról deployol; ott történik az ügyfélteszt. (A demo környezet
  beállítása külön ticket; amíg nincs, a demo teszt a helyi release-ágon fut.)

## 5. Élesítés: demo → main

- PR: `demo` → `main`, cím: `release: v0.3.0 (2026-11-26)`. A leírás a CHANGELOG szakasza, plusz „Figyelni”:
  env-változók, Woo plugin-frissítés, webhook-regisztráció, migráció, feature flag.
- Zöld CI (`gh pr checks <n>`, mindkét job), a demo teszt eredménye, bármelyik fejlesztő kifejezett
  „mehet”-je után **squash** merge.
- **Production:** a Vercel a `main`-ről automatikusan élesít, a CI-től függetlenül; ezért a zöld CI-t merge
  előtt kézzel kell megvárni. A merge maga a kiadás.

## 6. GitHub release, a többi komponens, élő ellenőrzés

```bash
gh release create v0.3.0 --target main --generate-notes --notes "<rövid magyar összefoglaló, opcionális>"
```

- Trigger.dev, WordPress-plugin és egyéb deploy a „Figyelni” lista szerint, pontosan ebből a commitból.
  (A pontos parancsok az éles compose és a Cloudflare beállítása után kerülnek ide, ADR-0008.)
- Élő ellenőrzés brandenként: főoldal, egy termékoldal, kosárba tétel, checkout-oldal betölt, Sentryben nincs
  új hiba, a webhook-endpoint 2xx-et ad. Valódi fizetést élesben csak kérésre teszünk.
- Jira: a kiadott ticketek „Done” állapota a felhasználó kérésére; a verzió neve `v0.3.0`.
- **`main` → `demo` szinkron PR** (merge commit), mert a squash commit nincs a `demo` történetében; enélkül a
  következő `demo` → `main` PR ütközhet.
- A helyi release-ág és a kiadott ticketágak törölhetők (a törlés előtti ellenőrzés: `kg-git-workflow` →
  Worktree).

## Visszavonás

- Hibás kiadásnál a `main` squash commitját `git revert`-tel vonjuk vissza, külön ágon és PR-ral a `main`-re.
  Egy revert a kiadás összes ticketjét visszavonja.
- A revert az adatmigrációt nem vonja vissza; ezért migráció csak visszafelé kompatibilis lehet (új tábla,
  nullable vagy defaultos oszlop).

## Hotfix kiadás

1. Hotfix ág `KG-<n>` friss `origin/main`-ből, PR → `main` (squash), kockázatos review-szinttel, zöld CI-vel,
   egy fejlesztő „mehet”-jével.
2. Patch-verzió: a version-módosítás a hotfix PR része (`package.json` + `CHANGELOG.md`), külön `version/*`
   ág nélkül.
3. `gh release create`, mint a 6. lépésben, majd `main` → `demo` szinkron PR.

## Tilos

- GitHub release a `main`-en kívüli commitra.
- Kiadott verzió tagjének mozgatása vagy törlése.
- `demo` → `main` merge committal vagy piros CI-vel.
- A helyi release-ág pusholása, vagy deploy bármely más ágról élesre.
