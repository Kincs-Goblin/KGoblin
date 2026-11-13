---
name: kg-git-workflow
description: A KGoblin branch-logikája és git-szabályai - main, demo, ticketág, release/ÉÉÉÉ-HH-NN, version/vX.Y.Z, hotfix, spike; branchnév, commit-formátum, merge-stratégiák, demo frissítése és resetje, branch protection. Használd minden branch-, commit-, merge-, rebase-, demo- vagy hotfix-lépés előtt, és ha azt kérdezik, „melyik ágra”, „hogyan merge-eljek”, „tedd ki demóra”.
---

# kg-git-workflow

A folyamat neve **release train**: a ticketek az aktuális kiadás ágába gyűlnek, azt helyben
összeteszteljük, majd egyben megy a `main`-re. A `main` mindig kiadott, élesen futó kódot tartalmaz.
Döntés és indoklás: `docs/adr/0002-branch-strategia.md`. A kiadás lépései a `kg-release` skillben vannak.

## Ágak

| Ág | Szerepe | Honnan | Hová (PR) | Merge | Élettartama |
|---|---|---|---|---|---|
| `main` | Élesre kerülő kód; minden commitja kiadható | - | - | - | Tartós |
| `demo` | Ügyféltesztre összeállított változat | `main` | sehová, soha | `--no-ff` merge | Tartós, kiadásonként reset |
| ticketág `<típus>/KG-<n>-<leírás>` | Egy körülhatárolt feladat | friss `origin/main` | aktív `release/*` | squash | A feladat beolvasztásáig |
| `release/ÉÉÉÉ-HH-NN` | Kiadás előtti helyi összetesztelés | `main` | `main` | merge commit | Az adott kiadásig |
| `version/vX.Y.Z` | Verzió és release notes módosítása | a `release/*` ág | ugyanaz a `release/*` | squash | A PR beolvasztásáig |
| `hotfix/KG-<n>-<leírás>` | Sürgős élesjavítás | friss `origin/main` | `main` | squash | A PR beolvasztásáig |
| `spike/KG-<n>-<leírás>` | Kísérlet, prototípus | bárhonnan | sehová | - | Eldobható |

A `release/*` nevében a **tervezett kiadás napja** szerepel (pl. `release/2026-11-26`). Egyszerre egy aktív
release-ág van. Ha a kiadás csúszik, az ág neve marad; a következő ág új dátumot kap.

## Folyamat egy pillantásra

```
main ──●──────────────────────────────────────────●  v0.3.0 (tag → prod)
       │                                          ↑ merge commit
       └─ release/2026-11-26 ──●──●──●──────●─────┘
                               ↑  ↑  ↑      ↑ squash
                 feat/KG-12 ───┘  │  │      └── version/v0.3.0
                 fix/KG-15 ───────┘  │
                 feat/KG-18 ─────────┘   (mind friss origin/main-ből)

demo ← main + kiválasztott ticketágak (--no-ff), soha nem megy vissza máshova
hotfix/KG-20 → main (squash) → patch tag → main bemerge-elve az aktív release-be és a demóba
```

## Branchnév

`<típus>/KG-<n>-<kebab-leírás>`, ékezet nélkül, legfeljebb kb. 50 karakter.

- Típusok: `feat`, `fix`, `refactor`, `chore`, `docs`, `test`, `perf`, `style`, `ci`, plus `hotfix`
  és `spike`.
- Példák: `feat/KG-42-kosar-drawer`, `fix/KG-57-barion-redirect`, `docs/KG-60-adr-auth-plugin`.
- Ticket nélkül csak kivételesen, egyeztetve: `chore/<leírás>`, és a PR-ba `Ticket: nincs - <miért>`.
- Az ág nevében nem szerepelhet `claude`, `gemini`, `ai` vagy más eszköznév.
- **Agent által nyitott ideiglenes ág** (pl. worktree-ág; eszközönként: `docs/process/agent-adapters.md`): ha még nincs rajta saját
  munka, `git switch -C <új-név> origin/main`;
  ha már van, `git branch -m <új-név>`, és ellenőrizd: `git merge-base --is-ancestor origin/main HEAD`.

## Worktree (agentes ticketfejlesztés)

Az agent minden ticketet **külön git worktree-ben** fejleszt (`AGENTS.md`). Így a párhuzamos ticketek és
sessionök nem írják egymás fájljait, és a fő checkout tiszta marad. Ha az eszköz maga nyit worktree-t
(`docs/process/agent-adapters.md`), azt használd, és az ágát nevezd át a fenti szabály szerint.

```bash
# a fő checkoutból futtasd, hogy a worktree mellé kerüljön (ne egy másik worktree-be)
git fetch origin
git worktree add ../KGoblin-KG-42 -b feat/KG-42-kosar-drawer origin/main
cd ../KGoblin-KG-42
pnpm install                       # a node_modules worktree-nként külön van
```

- Egy worktree = egy ticket. Más ticketet ne kezdj benne; ugyanannak a ticketnek a stacked PR-ága
  (pl. a KG-5 2. PR-ja) mehet ugyanabba.
- A `.env.local` nem jön át (git-ignored): másold át kézzel a fő checkoutból. Titkot ne commitolj.
- A `git stash` közös minden worktree között: csupasz `git stash`/`git stash pop` helyett ideiglenes
  WIP-commit, vagy egyedi címkés `git stash push -u -m "<címke>"` és `git stash apply <sha>`.
- Egyszerre egy `pnpm dev` foglalja a 3000-es portot; párhuzamos worktree-nél állítsd le a másikat, vagy
  indítsd más porton (`pnpm --filter @kg/web dev -- -p 3001`). A lokális Docker-Woo (`kgoblin-local`) közös.
- Az utolsó PR merge-e után, a fő checkoutból: `git worktree remove ../KGoblin-KG-42`, majd
  `git branch -D feat/KG-42-kosar-drawer` (squash miatt a `-d` „not fully merged” hibát adna).

## Commit

- Angolul, Conventional Commits, kisbetűvel, felszólító módban: `feat(KG-42): add cart drawer`.
  A scope a ticketkulcs. Ticket nélkül: `chore: bump turbo`.
- Nem triviális commitnál a body röviden elmondja a **miértet** és az ellenőrzést.
- Tilos: `update`, `changes`, `wip` a `main`-re vagy `release/*`-ra kerülő üzenetben, és bármilyen
  AI-attribúció. Push előtt:
  ```bash
  git log origin/main..HEAD --format=%B | grep -iE "co-authored|generated with|claude|gemini|anthropic|🤖"
  ```
  Az eredmény legyen üres. Ha nem az, `git commit --amend` vagy interaktív javítás a saját ágon, kérésre.
- Stage-elj fájlonként. Lokális hack (proxy, debug flag, `.env.local`) soha nem kerül commitba.
- Ideiglenes biztonsági lazítás (teszthez) külön commitban, a visszavonás tervével, és vissza is vonod.

## Merge-stratégiák

| PR | Stratégia | Miért |
|---|---|---|
| ticketág → `release/*` | **squash**, a PR-cím a commit-üzenet | Ticketenként egy commit, tiszta release notes |
| `version/*` → `release/*` | **squash** | Egy `chore(release): vX.Y.Z` commit |
| `release/*` → `main` | **merge commit** (`--no-ff`) | A kiadás egy egységként látszik, a ticketcommitok megmaradnak |
| `hotfix/*` → `main` | **squash** | Egy commit, könnyű visszaállítani |
| `main` → aktív `release/*` (hotfix után) | **merge commit** | A hotfix ne vesszen el a következő kiadásban |
| bármi → `demo` | **merge commit** helyben, PR nélkül | A demo eldobható összeállítás |

## Szinkronban tartás

- Ha a `release/*` előrébb ment, és a ticketág ütközik vele: **merge-eld be** a release-ágat a ticketágba
  (`git merge --no-ff origin/release/<dátum>`), ne rebase-elj megosztott ágat. Ütközésnél mindkét változás
  szándékát értve oldd fel, ne tarts meg vakon egy teljes fájloldalt.
- Saját, még senkivel meg nem osztott ágon a rebase megengedett; push után már `--force-with-lease` kell,
  és csak a saját ticketágadon.
- Ha a ticket kicsúszik a kiadásból, a PR célágát állítsd át a következő `release/*` ágra.

## demo ág

- **Egyirányú:** a `demo`-ból soha semmi nem megy más ágba, és ticketágba sem merge-eled vissza.
- Két kiadás között: `git switch demo && git merge --no-ff origin/feat/KG-42-...` (vagy `origin/main`),
  build és gyors próba, majd push. Hogy mi került a demóra, azt a kért személy a csapatcsatornán jelzi.
- **Reset kiadásonként:** minden éles kiadás után a demo visszaáll a `main`-re (`kg-release` skill, 6. lépés):
  ```bash
  git fetch origin
  git switch demo && git reset --hard origin/main
  git push --force-with-lease origin demo
  ```
  Előtte jelezd a másik fejlesztőnek, és ellenőrizd, hogy nincs a demón olyan ticket, ami még ügyfélteszten van;
  ha van, a reset után merge-eld vissza.
- Agent a demót csak kifejezett kérésre módosítja, és a resetet csak kifejezett kérésre végzi el.

## hotfix

1. `hotfix/KG-<n>-<leírás>` friss `origin/main`-ből; a legkisebb javítás, reprodukáló teszttel, ha lehet.
2. PR → `main`, kockázatos review-szinttel (`kg-ticket-to-pr`), bármelyik fejlesztő „mehet”-jével.
3. Merge után patch tag (`kg-release` „Hotfix kiadás”).
4. A friss `main`-t merge-eld az aktív `release/*` ágba és a `demo`-ba.

## Branch protection (GitHubon kézzel kell beállítani)

| Ág | Beállítás |
|---|---|
| `main` | PR kötelező, jóváhagyás nem kötelező (0), zöld CI, lineáris history kikapcsolva (merge commit kell), force push és törlés tiltva |
| `release/*` | PR kötelező, jóváhagyás nem kötelező (0), zöld CI, force push tiltva |
| `demo` | Force push csak adminnak (a resethez), törlés tiltva |

A jóváhagyás azért 0, mert a merge-kapu bármelyik fejlesztő „mehet”-je (`AGENTS.md`), a GitHub pedig a
szerző saját jóváhagyását nem számolja.

Engedélyezett merge-módok a repóban: squash és merge commit; a rebase merge kikapcsolva.

## Tilos

- Közvetlen push a `main`-re vagy `release/*`-ra.
- A `demo` merge-e bármelyik másik ágba.
- A `release/*` merge-e bárhová, kivéve a `main`-t (release PR) és a vele szinkronizált ticketágat.
- Force push a `main`-re, a `release/*`-ra vagy más fejlesztő ágára.
- `--no-verify`, branch protection megkerülése, `--admin` merge.
