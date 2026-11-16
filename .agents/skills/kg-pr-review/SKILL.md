---
name: kg-pr-review
description: Egy KGoblin pull request review-ja a ticket ellen - a Jira-ticket AC-inak leképezése a diffre, a PR-leírás és az ADR-ek állításainak ellenőrzése a repóban, belső és külső ellentmondások, kihagyott vagy skipelt ellenőrzések, a PR-leírás frissessége. Csak findingot ad, nem javít és nem ír a GitHubra kérés nélkül. Használd, ha azt kérik, „review-zd a PR-t”, „nézd át a PR-okat”, „review a #14-re”, vagy ha a kg-ticket-to-pr 5. lépésében független reviewer kell.
---

# kg-pr-review

Szabályforrás: `AGENTS.md`. Kódhely és konvenciók: `kg-architecture`; a stack: `kg-stack`; a kockázati szint
a `kg-ticket-to-pr` 5. lépésében. A reviewer **csak findingot ad**: nem javít a PR-ágon, nem nyit helyette
PR-t, és GitHubra/Jirába csak kifejezett kérésre ír. Eszközönkénti részletek: `docs/process/agent-adapters.md`.

Fő elv: a review a **ticketet és a repót** is ellenőrzi, nem csak a diffet. A diff önmagában konzisztens
lehet, és közben ellentmondhat a ticketnek, egy ADR-nek vagy a kódnak, amiről a szerző nem tud.

## 1. Tárgy rögzítése

1. `git fetch origin`; `gh pr list` / `gh pr view <n> --json headRefOid,baseRefOid,body,statusCheckRollup,mergeable`.
2. Rögzítsd a base és head SHA-t (a verdikt ezekre szól). A diff a célághoz mér: `git diff origin/<base>...origin/<ág>`.
3. Ellenőrizd, nyitott-e még a PR, és a feje nincs-e már a célágban (pl. merge commit történt, de a PR
   nyitva maradt): `git merge-base --is-ancestor <head> origin/<base>`.
4. Kockázati szint (`kg-ticket-to-pr` 5.): ADR, `kg-stack`, skill és `AGENTS.md` változása szabályt vagy
   döntést rögzít, ezért **legalább normál**, akkor is, ha csak szöveg.

**PR előtti mód** (a `kg-ticket-to-pr` 5. lépése, még nincs PR): a tárgyat a megadott base/head SHA és a
PR-leírás **tervezete** (az „Ellenőrzés” rész szövege) adja; a `gh`- és CI-lépések kimaradnak, a tervezet
állításait pedig ugyanúgy ellenőrizd, mintha kész PR-leírás lenne.

## 2. Ticket és AC-leképezés

1. Olvasd be a ticketet és a hozzá tartozó alfeladatokat (Jira-eszköz vagy beillesztett szöveg; csak olvasás),
   a kommentekkel együtt. Ha a ticket nem olvasható (nincs Jira-eszköz), a szerző adja a promptba az AC-kat
   és a kommenteket; ha azt sem, az AC-leképezés „nem ellenőrzött”, és ezt kimondod.
2. Futtasd a `kg-ticket-refine` 3. lépését a ticketen: ha a ticket maga elavult vagy ellentmond a repónak,
   az külön finding **a ticketre**, nem a szerzőre.
3. Készíts AC → bizonyíték táblát: minden AC-hoz a diff helye (fájl:sor), a teszt, amelyik igazolja, és az, ami
   nincs igazolva. Ami a ticketben „kötelező” (pl. contract-teszt), és nem futott, az hiányzó AC.
4. A ticket „Bizonyíték” és „Külső rendszer” mezője szerint: igazolták-e valódi rendszer ellen? A
   fixture/MSW-zöld nem igazolja a külső rendszer viselkedését; a skipelt teszt nem sikeres teszt.

## 3. Állítások ellenőrzése a repóban

- **Minden, a repó állapotára vonatkozó állítás** (PR-leírás, ADR, README, kommentek, skill-szöveg): fájl vagy
  parancs létezik-e, a konvenció így működik-e. Eszköz: `git grep` / `git show origin/<base>:<fájl>`. Egy
  állítás, amit nem ellenőriztél, nem „rendben”, hanem „nem ellenőrzött”.
- **Belső ellentmondás:** a PR/ADR egyik része ellentmond-e a másiknak (pl. „belső végpont” és „nyilvános
  végpont”). Olvasd végig az egészet, ne csak a változott sorokat.
- **Külső ellentmondás:** elfogadott ADR-ek, a `kg-stack` sorai, a skillek, a meglévő kód konvenciói.
  Új függőség vagy szolgáltatás = stack-változás: van-e ADR és `kg-stack`-frissítés.
- **Frissesség:** a PR-leírás „nem futott” és „figyelni” állításai igazak-e még a Jira-kommentek és az új
  commitok alapján (utólag lefuttatott teszt után a leírás elavulhat). Eltérés = finding.
- **ADR:** a „Döntéshozók” és a „Jóváhagyás” sor a PR-ben kitöltött-e: kik hagyták jóvá, hol látszik (az
  opciós kérdés válasza, komment). A merge-hez adott „mehet” ezt megerősíti, nem pótolja (`kg-stack` 4-5.).
  Jóváhagyás nélküli ADR csak `javasolt` státuszú lehet.

## 4. Kód- és biztonsági szempontok

A `kg-ticket-to-pr` 5. lépésének reviewer-promptja szerint: bug, biztonság, adatszivárgás brandek között, ár-
vagy összegszámítás a kliensen, kihagyott hibaeset, FSD-sértés. Külső rendszerre (hitelesítés, TLS, proxy
mögötti viselkedés) épülő kódnál kérdezd meg: mi bizonyítja valódi ellen, hogy működik? Ha csak a szerző
feltételezése, az finding (közepes, ellenőrizendő), akkor is, ha a teszt zöld.

## 5. Eredmény

Magyarul, röviden, PR-enként (hosszú anyag fájlba):

- Fejléc: PR, szerző, base/head SHA, a ticket, a CI állapota, mit futtattál és mit nem (nem futtatott = kimondva).
- **Verdikt:** jóváhagyható · kis változtatás kérve · változtatás kérve · blokkoló.
- Findingok súlyossággal (magas: bug, biztonság, adatvesztés; közepes: hibás viselkedés vagy ellenőrizetlen
  külső feltételezés; alacsony: karbantarthatóság, szöveg), mindegyik `fájl:sor` + rövid indoklás + javítás.
- **Ticket-findingok** külön (a ticket hibája, nem a PR-é), átfogalmazás-javaslattal (`kg-ticket-refine`).
- Ellenőrizendő még, ami ezen a gépen nem futott.

## Amit ne csinálj

- Ne javíts a PR-ágon, ne nyiss helyette PR-t, ne merge-elj.
- Ne tegyél fel GitHub-review-t vagy Jira-kommentet kérés nélkül; kérésre a finding szövegét add át.
- Ne jelezz stíluspreferenciát valódi hibaként.
- Ne mondj „zöldet” arra, amit nem futtattál vagy nem olvastál el.
