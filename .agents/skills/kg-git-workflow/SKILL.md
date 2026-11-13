---
name: kg-git-workflow
description: A KGoblin branch-logikája és git-szabályai - main, demo, KG-<n> ticketág, helyi release/ÉÉÉÉ-HH-NN tesztág, version/vX.Y.Z, hotfix, refactor; worktree ticketenként, commit-formátum, merge-stratégiák, demo PR-ok, branch protection. Használd minden branch-, commit-, merge-, rebase-, demo- vagy hotfix-lépés előtt, és ha azt kérdezik, „melyik ágra”, „hogyan merge-eljek”, „tedd ki demóra”.
---

# kg-git-workflow

A folyamat a Tinati-workflow-ra épül: minden ticket a saját ágán készül, helyben egy release-tesztágon
összeteszteljük, egyenként PR-ral megy a `demo`-ra ügyféltesztre, végül egyetlen `demo` → `main` PR viszi
élesre. A `main` mindig kiadott, élesen futó kód. Döntés és indoklás: `docs/adr/0007-demo-alapu-kiadas.md`.
A kiadás lépései a `kg-release` skillben vannak.

## Ágak

| Ág | Szerepe | Honnan | Hová (PR) | Merge | Élettartama |
|---|---|---|---|---|---|
| `main` | Éles kód; minden merge kiadás | - | - | - | Tartós |
| `demo` | Ügyfélteszt; a demo környezet deployol belőle | `main` | `main` | squash | Tartós |
| `KG-<n>` | Egy ticket | friss `origin/main`, vagy az alap ticket ága | `demo` | merge commit | A kiadásig |
| `release/ÉÉÉÉ-HH-NN` | **Csak helyi** tesztág, nem pusholjuk | `origin/main` | sehová | - | A kiadásig |
| `version/vX.Y.Z` | A kiadási commit | a helyi release-ág | `demo` | merge commit | A PR beolvasztásáig |
| `KG-<n>` (hotfix) | Sürgős élesjavítás | friss `origin/main` | `main` | squash | A PR beolvasztásáig |
| `refactor/<terület>-<leírás>` | Technikai refaktor, futásidejű változás nélkül | friss `origin/main` | `demo` | merge commit | A kiadásig |
| `spike/KG-<n>` | Kísérlet, prototípus | bárhonnan | sehová | - | Eldobható |

## Folyamat egy pillantásra

```
KG-12 ──●──●─┐          (friss origin/main-ből, saját worktree-ben)
KG-15 ──●────┤
             ▼
release/2026-11-26 (helyi) ── --no-ff merge-ek + chore(release) commit → teljes ellenőrzés, kézi teszt
             │
             ▼  ticketenként PR, merge commit (az alap ticket a ráépülő előtt)
demo ──●──●──●── version/v0.3.0 PR ──→ demo környezet: ügyfélteszt
             │
             ▼  egyetlen PR, squash, zöld CI
main ──●  v0.3.0 (gh release)

hotfix: KG-20 friss main-ből → PR main (squash) → patch release → main → demo szinkron PR
```

## Branchnév

- Ticketág: **pontosan a ticketkulcs**, pl. `KG-42`. Ha egy másik, még nem élesített ticket kódjára épül,
  annak az ágából indul (pl. `KG-43` a `KG-42`-ből).
- Refaktor ticket nélkül: `refactor/<terület>-<leírás>`, pl. `refactor/fsd-cart-entity`.
- Kísérlet: `spike/KG-<n>`; soha nem megy PR-ba.
- Az ág nevében nem szerepelhet `claude`, `gemini`, `ai` vagy más eszköznév.
- A ticketágat csak a saját demo PR-jához (hotfixnél a `main` PR-hoz) pusholjuk.
- **Agent által nyitott ideiglenes ág** (pl. worktree-ág; eszközönként: `docs/process/agent-adapters.md`):
  ha még nincs rajta saját munka, `git switch -C KG-<n> origin/main`; ha már van, `git branch -m KG-<n>`,
  és ellenőrizd: `git merge-base --is-ancestor origin/main HEAD`.

## Worktree (agentes ticketfejlesztés)

Az agent minden ticketet **külön git worktree-ben** fejleszt (`AGENTS.md`). Így a párhuzamos ticketek és
sessionök nem írják egymás fájljait, és a fő checkout tiszta marad. Ha az eszköz maga nyit worktree-t
(`docs/process/agent-adapters.md`), azt használd, és az ágát nevezd át a fenti szabály szerint.

```bash
# a fő checkoutból futtasd, hogy a worktree mellé kerüljön (ne egy másik worktree-be)
git fetch origin
git worktree add ../KGoblin-KG-42 -b KG-42 origin/main
cd ../KGoblin-KG-42
pnpm install                       # a node_modules worktree-nként külön van
```

- Egy worktree = egy ticket. Más ticketet ne kezdj benne.
- A `.env.local` nem jön át (git-ignored): másold át kézzel a fő checkoutból. Titkot ne commitolj.
- A `git stash` közös minden worktree között: csupasz `git stash`/`git stash pop` helyett ideiglenes
  WIP-commit, vagy egyedi címkés `git stash push -u -m "<címke>"` és `git stash apply <sha>`.
- Egyszerre egy `pnpm dev` foglalja a 3000-es portot; párhuzamos worktree-nél állítsd le a másikat, vagy
  indítsd más porton (`pnpm --filter @kg/web dev -- -p 3001`). A lokális Docker-Woo (`kgoblin-local`) közös.
- A kiadás után, a fő checkoutból: `git worktree remove ../KGoblin-KG-42`, majd `git branch -D KG-42` (a
  `main`-re squash-sal kerül, ezért a `-d` „not fully merged” hibát adna).

## Commit

- Angolul, Conventional Commits, kisbetűvel, felszólító módban, ticketre szűkítve:
  `feat(KG-42): add cart drawer`. Ticket nélküli refaktor: `refactor(fsd): ...`.
- Nem triviális commitnál a body röviden elmondja a **miértet** és az ellenőrzést.
- **AI-val készült commit** az eszköz által adott `Co-Authored-By` footert kapja (pl.
  `Co-Authored-By: <modell> <noreply@…>`). A PR-leírásban és az ágnévben nincs AI-jelölés
  („Generated with”, 🤖).
- Tilos: `update`, `changes`, `wip` a `demo`-ra vagy `main`-re kerülő üzenetben.
- Stage-elj fájlonként. Lokális hack (proxy, debug flag, `.env.local`) soha nem kerül commitba.
- Ideiglenes biztonsági lazítás (teszthez) külön commitban, a visszavonás tervével, és vissza is vonod.

## Merge-stratégiák

| PR / lépés | Stratégia | Miért |
|---|---|---|
| ticketág → helyi `release/*` | `git merge --no-ff`, az alap ticket a ráépülő előtt | Helyi összetesztelés, PR nélkül |
| `KG-<n>` → `demo` | **merge commit** | A ticket commitjai megmaradnak a demón |
| `version/vX.Y.Z` → `demo` | **merge commit** | A kiadási commit külön látszik |
| `main` → `demo` (szinkron) | **merge commit** | A demo ne maradjon le a `main`-ről |
| `demo` → `main` | **squash** | Kiadásonként egy commit, egy reverttel visszavonható |
| hotfix `KG-<n>` → `main` | **squash** | Egy commit, könnyű visszaállítani |

A merge-kapu (`AGENTS.md`): zöld CI (ahol fut), lezárt review-ciklus és bármelyik fejlesztő kifejezett
„mehet”-je. A CI csak a `main`-re menő PR-okon fut; a `demo` PR-ok kapuja a helyi release-teszt, amelynek
eredménye a PR „Ellenőrzés” részébe kerül.

## Szinkronban tartás

- Ha a `demo` PR ütközik: a ticketágba merge-eld be az `origin/main`-t vagy az alap ticket ágát, ne a
  `demo`-t. A `demo` soha nem megy ticketágba.
- Ha a `demo`-ból hiányzik a `main` friss állapota (pl. hotfix után), előbb `main` → `demo` szinkron PR
  (merge commit), utána a ticket PR-ok.
- Saját, még senkivel meg nem osztott ágon a rebase megengedett; push után már `--force-with-lease` kell, és
  csak a saját ticketágadon.

## demo ág

- Minden változás **PR-ral** megy rá: nincs közvetlen push, force push vagy reset.
- A ticket PR-ok sorrendje: az alap ticket a ráépülő előtt; a kiadási commit a `version/*` PR-ral.
- Ami a demón elbukik az ügyfélteszten, azt a ticketág javítja új committal, és új PR (vagy a nyitott PR
  frissítése) viszi a demóra.
- Agent a demóra csak kifejezett kérésre nyit vagy merge-el PR-t.

## hotfix

1. `KG-<n>` friss `origin/main`-ből; a legkisebb javítás, reprodukáló teszttel, ha lehet.
2. PR → `main`, kockázatos review-szinttel (`kg-ticket-to-pr`), zöld CI-vel, bármelyik fejlesztő
   „mehet”-jével, squash.
3. Patch-kiadás (`kg-release` „Hotfix kiadás”), majd `main` → `demo` szinkron PR.

## Branch protection (GitHubon kézzel kell beállítani)

| Ág | Beállítás |
|---|---|
| `main` | PR kötelező, jóváhagyás nem kötelező (0), kötelező checkek: „Quality gate” és „E2E (Playwright)”, force push és törlés tiltva |
| `demo` | PR kötelező, jóváhagyás nem kötelező (0), force push és törlés tiltva |

A jóváhagyás azért 0, mert a merge-kapu bármelyik fejlesztő „mehet”-je (`AGENTS.md`), a GitHub pedig a
szerző saját jóváhagyását nem számolja.

Engedélyezett merge-módok a repóban: squash és merge commit; a rebase merge kikapcsolva.

## Tilos

- Közvetlen push a `main`-re vagy a `demo`-ra, kis fixre sem.
- A helyi `release/*` ág pusholása vagy PR-ba tétele.
- A `demo` merge-e ticketágba.
- Force push a `main`-re, a `demo`-ra vagy más fejlesztő ágára.
- `--no-verify`, branch protection megkerülése, `--admin` merge.
