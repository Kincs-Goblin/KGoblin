---
name: kg-ticket-to-pr
description: Egy KG Jira-ticket teljes végigvitele a KGoblin repóban - ticket beolvasása, Definition of Ready, ticketág friss mainből, terv, implementáció a kg-architecture szerint, quality gate, független AI review kockázati szinttel, PR az aktív release/* ágba, CI-követés. Használd, ha azt kérik, „vidd végig a KG-42-t”, „csináld meg ezt a ticketet”, „javítsd ki ezt a hibát”, „nyiss PR-t erre”, „írd meg a PR-leírást”.
---

# kg-ticket-to-pr

Szabályforrás: `AGENTS.md`. Branch és merge: `kg-git-workflow`. Kódhely: `kg-architecture`. Ha ezek
mást mondanak, mint ez a skill, azok az irányadók; jelezd az eltérést.

## Jóváhagyási kapuk (nem alkuképes)

- Felderítés, implementáció és helyi ellenőrzés szabadon mehet.
- **Kifejezett kérés kell**, és egy korábbi jóváhagyás nem vonatkozik a következő lépésre: commit, push,
  PR-nyitás, merge, Jira-komment vagy -státuszváltás, demo-frissítés, deploy, külső rendszer beállítása.
- Üzleti elfogadást (ügyfélteszt, „Done”) soha nem találsz ki. A helyi böngészős próba nem ügyfélteszt.
- Csak azt nevezed zöldnek, amit most lefuttattál.

## 0. Ticket és Definition of Ready

1. Olvasd be a ticketet. Ha van Jira-eszköz a sessionben, azzal (csak olvasás); ha nincs, kérd meg a
   felhasználót, hogy illessze be a leírást és az elfogadási kritériumokat. Link:
   `https://kincsgoblin.atlassian.net/browse/KG-<n>`.
2. Ellenőrizd a **Definition of Ready**-t (`docs/process/ticket-template.md`):
   cél egy mondatban · ellenőrizhető elfogadási kritériumok · scope és ami nem része · érintett terület ·
   elvárt bizonyíték · kockázat. Ami hiányzik vagy ellentmondásos: kérdezz, ne találj ki.
3. Foglald össze röviden: mit kér a ticket, mi nem része, mik az AC-k, mi a nyitott kérdés.
4. **Stack-ellenőrzés:** ha a megoldás új szolgáltatást, könyvtár-kategóriát vagy integrációt igényelne,
   állj meg, és kövesd a `kg-stack` folyamatát.

## 1. Munkakörnyezet

```bash
git fetch origin
git status --short          # tiszta legyen
git switch -c feat/KG-42-kosar-drawer origin/main
```

T3 Code worktree esetén az átnevezés szabálya a `kg-git-workflow`-ban van. Nézd meg, melyik az aktív
release-ág (`git branch -r --list "origin/release/*"`); a PR oda megy. Ha nincs ilyen, kérdezz.

## 2. Felderítés és terv

- Olvasd el az érintett FSD-szeleteket, a `packages/woo-client` releváns részét és a meglévő teszteket.
  Előbb a meglévő mintát és segédfüggvényt keresd, és csak ha nincs ilyen, hozz létre újat.
- Rövid terv (triviális javításnál 3-4 sor): érintett szeletek és fájlok, adatfolyam (Store API vagy REST v3,
  cache-tag), hibakódok, brandhatás, teszt-stratégia, UI-irány. A kimenet formája a `kg-architecture` 3.
  lépésében van.
- Több réteget érintő vagy kockázatos változásnál (lásd review-szint) várd meg a terv jóváhagyását.

## 3. Implementáció

- FSD-rétegszabály, public API (`index.ts`), Woo-hívás csak a szerveren, Zod a válaszokon, ár és végösszeg
  csak a Woo-ból, brand a kontextusból (soha nem hardcode-olva). Részletek: `kg-architecture`.
- Bugfixnél előbb reprodukáló teszt, ha az érdemben igazolja a hibát.
- UI-nál „előtte” screenshot az első módosítás előtt (a git által ignorált `output/ui-review/KG-<n>/` alá).
- A scope-on túli észrevételt ne javítsd, hanem írd fel follow-upnak.

## 4. Quality gate

Fusson előbb célzott teszt, aztán a teljes ellenőrzés (amint a scaffold elkészül, a pontos parancsok az
`AGENTS.md`-be kerülnek):

```bash
pnpm turbo run typecheck lint test --filter=...[origin/main]
pnpm --filter web lint:fsd      # Steiger
pnpm turbo run build --filter=...[origin/main]
```

UI-változásnál vizuális önellenőrzés: mobil, tablet és desktop töréspont, mindegyik érintett brand-téma,
billentyűzetes navigáció, konzolhibák, „utána” screenshot ugyanarról a nézetről. Checkout- és
fizetési változásnál végigkattintás a teszt-gatewayjel a lokális vagy a preview környezetben.

## 5. Review-ciklus (PR előtt)

Független review egy **friss sessionben**, amelyik nem látta a fejlesztést. Ha elérhető, **más modell**
review-zzon, mint amelyik implementált (Claude ↔ Gemini/Antigravity). A review nem helyettesíti a tesztet.

### Review-szint a diff alapján

Ha bizonytalan vagy, a magasabbat válaszd. A szint bekerül a PR „Ellenőrzés” részébe.

- **Könnyű:** csak docs, szöveg, komment, config-érték, teszt, függőség patch-verziója. 1 kör.
- **Normál:** minden más kódváltozás. Legfeljebb 3 kör.
- **Kockázatos:** fizetés, checkout, kosár-összeg, auth és session, webhook-aláírás, rendelés-továbbítás a
  beszállítónak, számlázás, személyes adat, titokkezelés, brand-elkülönítés (egyik brand adata a másiknál),
  migráció. Legfeljebb 5 kör; a 4. kör előtt írd le, miért kell.

### Menet

1. Rögzítsd a review tárgyát: `git fetch origin`, base = `origin/release/<dátum>`, és a base/head SHA.
2. Reviewer-prompt (Claude Code példa):
   `claude -p "Review-zd a git diff ${BASE_SHA}...${HEAD_SHA} változásait a KGoblin AGENTS.md és a kg-architecture szerint. Csak valódi hibát jelezz (bug, biztonság, adatszivárgás brandek között, ár- vagy összegszámítás a kliensen, kihagyott hibaeset, FSD-sértés), fájl:sor és rövid indoklás. A nem futtatott teszt nem sikeres teszt. Add meg a review-zott SHA-kat és a verdiktet." --allowedTools "Bash(git diff:*),Bash(git log:*),Read,Grep,Glob"`
   Antigravityben ugyanez a prompt egy új agent-sessionben, read-only módban.
3. Minden findingot fogadj el, bizonyítékkal vess el, vagy jóváhagyással halassz el. A javítás után célzott
   teszt, majd új review-kör az új head SHA-n.
4. Megállás: ha a keret elfogyott, vagy a reviewer nem elérhető, állítsd le a ciklust, és kérj emberi döntést.
   Új commit vagy sessionváltás nem nullázza a körszámlálót. Nincs automatikus jóváhagyás.

Eredménysor a PR-ba: `Review: Gemini, normál - 2/3 kör, jóváhagyva; head <SHA>; 2 javítva, 1 elvetve (X)`.

## 6. PR (kérésre)

- Előtte: AI-attribúció-ellenőrzés (`kg-git-workflow` → Commit), `git diff --stat`, aztán `git diff`.
- **Cél:** az aktív `release/<dátum>` ág (hotfixnél a `main`).
- **Cím:** angolul, `típus(KG-<n>): mit csinál`, pl. `feat(KG-42): add cart drawer`. Több ticketnél az
  első a címben, a többi a leírásban.
- **Leírás:** magyarul, a `.github/pull_request_template.md` szerint. Az Összefoglaló, a Ticketek és a
  Változások együtt legfeljebb kb. 10 sor. Az üres template-kommenteket töröld; a „Figyelni” rész csak
  akkor kell, ha van benne valami.
- A **Stack-változás** jelölőnégyzetet pipáld, ha a PR ADR-t vagy `kg-stack` módosítást tartalmaz.
- Reviewer: a másik fejlesztő (CODEOWNERS). WIP-limit: fejlesztőnként legfeljebb 2 nyitott PR.

## 7. PR után

- Kövesd a CI-t a végéig (`kg-babysit-pr`). Piros CI-t javíts a PR-ágon; ha nem megy, írd le, mi blokkol.
- A merge az emberé (a másik fejlesztő jóváhagyása után), squash-sal a release-ágba. Az agent csak
  kifejezett kérésre merge-el, és csak zöld CI és jóváhagyás mellett.
- 7 napnál régebbi PR nem maradhat nyitva: vagy merge, vagy lezárás indoklással.
- Jira: a felhasználó kérésére „Review” állapot, ellenőrzési kommenttel. „Done” csak kiadás után.

## 8. Kész-jelentés

Röviden: mi változott, mit futtattál és mi lett az eredménye, mi nincs ellenőrizve, a PR-link, a nyitott
kockázatok és a follow-upok.
