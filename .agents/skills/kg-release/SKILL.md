---
name: kg-release
description: A KGoblin kiadási folyamata (release train) - release/ÉÉÉÉ-HH-NN ág vágása, helyi összetesztelés, version/vX.Y.Z PR verzióval és CHANGELOG-gal, release → main PR, tag és GitHub release, prod deploy és élő ellenőrzés, demo reset, hotfix kiadás, SemVer-szabályok. Használd, ha release-t, kiadást, verzióemelést, taget, prod deployt, demo resetet vagy hotfixkiadást kérnek, vagy ha azt kérdezik, „mi megy ki a következő kiadásban”.
---

# kg-release

Minden lépés **csak kifejezett kérésre** indul, és egy korábbi jóváhagyás nem vonatkozik a következő lépésre.
Az ágak szabályai a `kg-git-workflow` skillben vannak.

A kiadást bármelyik fejlesztő viheti, nincs kijelölt release-felelős. Aki vágja a release-ágat, az viszi
végig a kiadást; a version PR-t és a release PR-t a másik fejlesztő hagyja jóvá.

## Verziózás (SemVer)

- Tag: `vX.Y.Z`, a gyökér `package.json` `version` mezőjével egyezik.
- **Indulás előtt** `0.Y.Z`: új funkció → `Y`, csak javítás → `Z`.
- **`v1.0.0`** az első brand (gamer) nyilvános indulása; ezt csak kifejezett kérésre emeled.
- **Indulás után:** a kiadás egészéből döntesz. Új funkció a vásárlónak vagy a shop-adminnak → minor;
  csak javítás, szöveg, finomhangolás → patch; vásárlói fiókot, URL-szerkezetet (SEO) vagy integrációs
  szerződést törő változás → major, kizárólag kérésre.
- Hotfix mindig patch. Kiadott verzió tartalma nem változik; a javítás új verzió.

## 1. Release-ág vágása

```bash
git fetch origin
git switch -c release/2026-11-26 origin/main
git push -u origin release/2026-11-26
```

- A dátum a tervezett kiadás napja. Egyszerre egy aktív release-ág van.
- Szólj a másik fejlesztőnek; a nyitott ticket-PR-ok célágát átállítjátok (`gh pr edit <n> --base release/…`).

## 2. Összetesztelés (helyben és a branch-preview-n)

- A release-ág fáján: teljes `typecheck`, `lint`, Steiger, `test`, `build`, és Playwright e2e a fő
  vásárlói úton (főoldal → kategória → termék → kosár → checkout teszt-gatewayjel → visszaigazolás),
  **minden érintett brandre**.
- Ha volt Woo plugin-, webhook- vagy job-változás: a lokális Docker-Woo-n valódi rendelés, és nézd meg, mi
  keletkezett (rendelés, beszállítói továbbítás a fake adapterrel, email, Billingo sandbox).
- A hibát a ticketág javítja (új PR a release-ágba); közvetlenül a release-ágon nem javítunk.
- Ami nincs kipróbálva, azt írd le a release PR „Figyelni” részébe.

## 3. version/vX.Y.Z PR

```bash
git switch -c version/v0.3.0 origin/release/2026-11-26
```

1. Válaszd ki a verziót a fenti szabályok szerint, a release-ág squash commitjaiból
   (`git log origin/main..origin/release/2026-11-26 --oneline`). Javasold, és kérdezz rá.
2. `package.json` `version` mező(i), és a `CHANGELOG.md` új szakasza magyarul, felhasználói nyelven:
   `## [0.3.0] - 2026-11-26` → Új · Javítva · Változott · Belső (ticketkulccsal).
3. PR → `release/2026-11-26`, cím: `chore(release): v0.3.0`, squash.

## 4. Release PR → main

- PR: `release/2026-11-26` → `main`, cím: `release: v0.3.0 (2026-11-26)`. A leírás a CHANGELOG szakasza,
  plusz „Figyelni”: env-változók, Woo plugin-frissítés, webhook-regisztráció, migráció, feature flag.
- A másik fejlesztő jóváhagyása és zöld CI után **merge commit** (nem squash).
- **Production:** a Vercel a `main`-ről automatikusan élesít, ezért ez a merge maga a frontend deploy.
  Az agent csak kifejezett kérésre merge-el.

## 5. Tag, release, a többi komponens deployja, élő ellenőrzés

```bash
git fetch origin
gh release create v0.3.0 --target <main merge commit SHA> --title "v0.3.0" --notes-file <changelog-szakasz>
```

- Trigger.dev, WordPress-plugin és egyéb deploy a „Figyelni” lista szerint, pontosan ebből a commitból.
  (A pontos parancsok a scaffold és a hosting-döntés után kerülnek ide.)
- Élő ellenőrzés brandenként: főoldal, egy termékoldal, kosárba tétel, checkout-oldal betölt, Sentryben nincs
  új hiba, a webhook-endpoint 2xx-et ad. Valódi fizetést élesben csak kérésre teszünk.
- Ha a deploy elbukik: jelezd, a javítás hotfixként, új patch-verzióval megy ki.

## 6. Kiadás után

1. **Demo reset** a `main`-re (`kg-git-workflow` → demo ág), bejelentve.
2. A release-ág törölhető (`git push origin --delete release/2026-11-26`), a tag megőrzi a történetet.
3. Jira: a kiadott ticketek „Done” állapota a felhasználó kérésére; a verzió neve `v0.3.0`.
4. A következő release-ág vágása, ha már van rá munka.

## Hotfix kiadás

1. `hotfix/KG-<n>-…` PR → `main` (squash), kockázatos review-szinttel, jóváhagyással.
2. Patch-verzió: a version-módosítás a hotfix PR része (`package.json` + `CHANGELOG.md`), külön `version/*`
   ág nélkül.
3. Tag és release, mint az 5. lépésben, majd a `main` merge-e az aktív `release/*`-ba és a `demo`-ba.

## Tilos

- Tag vagy GitHub release a `main`-en kívüli commitra.
- Kiadott verzió tagjének mozgatása vagy törlése.
- Release PR squash-sal.
- Deploy a release-ágról élesre.
