# ADR-0007: Demo-alapú kiadási folyamat (a Tinati-workflow alapján)

- Állapot: elfogadott
- Dátum: 2026-11-13
- Döntéshozók: SMark2256, ricsmond12
- Ticket: KG-5
- Felváltja: ADR-0002

## Kontextus

- Az ADR-0002 release trainje GitHubon élő `release/*` ágat, ticketenként squash PR-t és külön release PR-t
  ír elő. A csapat egy másik projektje (Tinati) bevált folyamata egyszerűbb: a ticketek egyenként mennek
  ügyféltesztre, és egyetlen PR viszi őket élesre.
- A merge-kapu 2026-11-13 óta: zöld CI (ahol fut), lezárt független AI review-ciklus és bármelyik fejlesztő
  kifejezett „mehet”-je.
- Az AI agentek ticketenként külön worktree-ben dolgoznak.

## Döntés

| Ág | Szerepe | Honnan | Hová (PR) | Merge |
|---|---|---|---|---|
| `main` | Éles kód; minden merge kiadás | - | - | - |
| `demo` | Ügyfélteszt, a demo környezet deployol belőle | `main` | `main` | squash (élesítés) |
| `KG-<n>` | Egy ticket, pontosan a kulcsáról elnevezve | friss `origin/main` (vagy az alap ticket ága) | `demo` | merge commit |
| `release/ÉÉÉÉ-HH-NN` | Csak helyi tesztág: a kész ticketágak `--no-ff` merge-e és a kiadási commit | `origin/main` | sehová, nem pusholjuk | - |
| `version/vX.Y.Z` | A kiadási commit (`chore(release): vX.Y.Z`) | a helyi release-ág | `demo` | merge commit |
| `KG-<n>` hotfix | Sürgős élesjavítás | friss `origin/main` | `main` | squash |
| `refactor/<terület>-…` | Futásidejű változás nélküli technikai refaktor, ticket nélkül | friss `origin/main` | `demo` | merge commit |

- A `demo`-ra minden változás PR-ral megy: nincs közvetlen push, force push vagy reset. Ha a `demo`-ból
  hiányzik a `main` friss állapota, előbb `main` → `demo` szinkron PR megy (merge commit).
- Élesítés: a demo teszt után egyetlen `demo` → `main` PR, squash. Utána `gh release create`.
- CI csak a `main`-re menő PR-okon és a `main` pushán fut; a `demo` PR-ok kapuja a helyi ellenőrzés a
  release-tesztágon.
- Visszavonás: a kiadás squash commitjának `git revert`-je külön ágon és PR-ral.
- AI-val készült commit az eszköz által adott `Co-Authored-By` footert kapja; a PR-leírásban és az ágnévben
  nincs AI-jelölés.
- A KGoblin a Tinatihoz képest megtartja: a hotfix-utat a `main`-re, a verziót a gyökér `package.json`-ban
  és a `CHANGELOG.md`-ben, a független AI review-ciklust és a merge-kaput.

A végrehajtás részletei: `kg-git-workflow` és `kg-release` skill.

## Következmények

- Egy ticket egy ág, egy demo PR; a release-ág nem él GitHubon, ezért nincs célág-átállítás.
- A `main` lineárisan, kiadásonként egy squash committal nő; egy revert az egész kiadást visszavonja.
- A `demo` PR-okon nincs CI, ezért a helyi release-teszt kötelező, és az eredménye a PR-ba kerül.
- A demo környezet (Vercel branch-deploy a `demo`-ról) beállítása külön ticket.
- Átállás: a 2026-11-13-án GitHubon élő `release/2026-11-26` még a régi modell szerint (release PR) megy a
  `main`-re; utána jön létre a `demo` ág a `main`-ből, és ettől kezdve ez az ADR érvényes.
- Frissítve: `AGENTS.md`, `kg-git-workflow`, `kg-release`, `kg-ticket-to-pr`, `kg-babysit-pr`, `kg-full-stop`,
  `kg-stack` (Branch-folyamat és CI sor), az `.agents/workflows/` érintett fájljai, `.github/workflows/ci.yml`.

## Mérlegelt alternatívák

| Alternatíva | Miért nem |
| ----------- | --------- |
| Az ADR-0002 release trainje | Több lépés és élő release-ág; a csapat a Tinati-folyamatot választotta |
| Csak az ágelnevezés átvétele | A kiadási modell kettőssége félreértést okozna |
| Hotfix is a `demo`-n át | A demón lehet még teszt alatt álló ticket, ezért a hotfix nem várhat rá |
