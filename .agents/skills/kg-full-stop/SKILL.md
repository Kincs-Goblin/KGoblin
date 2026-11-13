---
name: kg-full-stop
description: Használd, ha a felhasználó azt írja, „full stop” (akkor is, ha mondatzáró hangsúlynak tűnik) a KGoblin repóban. A feladatot felügyelet nélkül, végig viszi egy merge-elhető PR-ig a demo ágra (hotfixnél a main-re), bizonyítékkal, AI review-val és CI-követéssel, de soha nem merge-el.
---

# kg-full-stop

Forrás: a BILDR HUB agent-kit `full-stop`/`full-send` skillje (az pedig a t3dotgg/tstack, MIT), a KGoblin
folyamatára igazítva. A projekt szabályai (`AGENTS.md`, `kg-git-workflow`, `kg-ticket-to-pr`) elsőbbséget
élveznek.

Ha a felhasználó ezt kérte, nem figyeli a threadet: a köztes üzeneteidet és a záró jelentésedet csak
jóval később olvassa. A munka a jelenlegi állapottól egy merge-elhető PR-ig a tiéd.

## Mire ad engedélyt a „full stop”

- Commit, push, PR-nyitás és frissítés **a feladat saját ágán és PR-jában**; rebase és ütközésfeloldás;
  `--force-with-lease` csak a saját ágon.
- A bizonyításhoz szükséges tesztmódszerek kérdés nélkül: dev szerver, böngésző-automatizálás, screenshot,
  lokális Docker-Woo, fake beszállítói adapter, gateway-sandbox.

**Nem** ad engedélyt: merge, auto-merge, push a `main`-re vagy a `demo`-ra, tag, deploy,
Jira-írás, éles rendszer vagy éles adat érintése, külső fiók beállítása, más PR lezárása, branch
protection megkerülése.

## Lépések

1. **Ticket és terv:** `kg-ticket-to-pr` 0-2. Ha a cél úgy kétértelmű, hogy az az eredményt is
   megváltoztatja, vagy stack-változás kellene (`kg-stack`), kérdezz (lásd lent).
2. **Változtatás:** a legkisebb működő megoldás, a `kg-architecture` szerint. Ha az alapértelmezett ágon
   vagy, előbb ágat hozol létre (`kg-git-workflow`).
3. **Bizonyítás:** minden változtatásra (lásd „Bizonyíték”).
4. **Review:** a `kg-ticket-to-pr` 5. lépése, a kockázati szint szerint. A jogos findingot javítsd, a többit
   írásos indokkal vesd el.
5. **PR:** cél a `demo` (hotfixnél `main`), a helyi release-teszt után, cím és leírás a `kg-ticket-to-pr` szerint, egy
   sorral arról, hogyan bizonyítottad a változást. Előtte frissíts a célágról, és futtasd az
   attribúció-ellenőrzést (`kg-git-workflow` → Commit).
6. **Követés:** `kg-babysit-pr`. CI-hibát és jogos review-findingot javíts; minden javításra bizonyíték.
7. **Átadás a kapunál** (lásd „Kapu”).

Az 1-7. lépés alatt maradj aktív. Ha checkre vagy botra vársz, a watcherrel várj (`kg-babysit-pr`), ne sima
üzenettel. Kérdés vagy átadás előtt állítsd le a watchert.

## Bizonyíték

Amit ebben a sessionben magad figyeltél meg: parancskimenet, reprodukció, screenshot. A legközvetlenebb:

- a hiba reprodukálása, javítás, majd ugyanaz a reprodukció sikeresen;
- a CI-vel azonos ellenőrzések (typecheck, lint, Steiger, teszt, build);
- egy célzott teszt, ami a javítás nélkül elbukik;
- UI- és checkoutváltozásnál az app futtatása és a változás megnézése minden érintett brandre. A zöld,
  mockolt teszt nem bizonyítja, hogy a vásárlói élmény működik.

Ha nem tudod bizonyítani, nincs teljes bizonyosságod: kérdezz.

## Kapu (merge-elhető állapot)

A legutolsó commiton igaz minden:

- a bizonyíték a teljes diffet lefedi;
- a kötelező checkek zöldek;
- a review lezárult, minden finding javítva vagy írásos indokkal elvetve;
- nincs változtatást kérő emberi review;
- az ág naprakész a célággal, és a GitHub mergeable-nek mutatja.

Átadás: **Kész a merge-re** (a merge-hez még egy fejlesztő kifejezett „mehet”-je kell, és ezt ki is mondod) · vagy
**Blokkolt** (mi akadályoz, mit próbáltál, mi kell). A jelentés tartalma: PR-link, head SHA, verdikt,
bizonyíték, a review eredménye, a meghozott döntések, a megmaradt kockázatok, és hogy a PR nyitva,
merge nélkül maradt.

## Kérdezés

Kérdést az eszközöd kérdező funkciójával tegyél fel (`docs/process/agent-adapters.md`), hogy a thread várakozó állapotot mutasson. Benne legyen a PR-link, mi blokkol, és az
opciók, a javasolt elöl. Csak akkor kérdezz, ha nem tudsz továbbmenni: nem bizonyítható a változás, a kapu
nem teljesíthető, a következő lépés túlmegy az engedélyen, a cél kétértelmű, vagy stack-változás kellene.
Minden másban dönts ésszerű alapértelmezéssel, és sorold fel a jelentésben.

Ha nincs kérdező eszköz, vagy nem jön válasz: hagyd nyitva a PR-t, és a záró üzenetet a kérdéssel kezdd.
