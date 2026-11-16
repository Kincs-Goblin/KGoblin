---
name: kg-ticket-refine
description: Egy KG Jira-ticket (vagy egy ticket-csoport) ellenőrzése és átfogalmazása munka előtt - Definition of Ready, frissesség a ticket dátuma óta elfogadott ADR-ekhez és a mai kódhoz képest, ellentmondások a repóval, döntési ticket sablon. Átfogalmazás-javaslatot ad, Jira-írás csak kifejezett kérésre. Használd, ha azt kérik, „finomítsd a ticketet”, „refine”, „nézd meg, jó-e a ticket”, „írd át a ticketet”, vagy ha a kg-ticket-to-pr 0. lépése elavultságot vagy ellentmondást talál.
---

# kg-ticket-refine

Szabályforrás: `AGENTS.md`. Sablon és Definition of Ready: `docs/process/ticket-template.md`. Ez a skill
**read-only**: a ticketet nem írja át a Jira-ban, csak javaslatot ad (lásd 5. lépés). Eszközönkénti részletek
(Jira olvasása, kérdés): `docs/process/agent-adapters.md`.

Miért kell: a ticketek előre íródnak, a repó közben mozog. Egy ticket, amelyik a megírásakor jó volt, a
megvalósításkor már ellentmondhat egy azóta elfogadott ADR-nek vagy a kód konvenciójának. Ezt munka előtt
kell megfogni, nem a review-n.

## 1. Beolvasás

- Ticket: leírás, létrehozás dátuma, státusz, assignee, szülő, linkek, kommentek. Ha van Jira-eszköz, azzal
  (csak olvasás); ha nincs, kérd meg a felhasználót, hogy illessze be a leírást, a létrehozás dátumát és a
  kommenteket. Ha több ticketet vizsgálsz (story + alfeladatok), egyszerre olvasd be őket.

## 2. Definition of Ready

Mezőnként: cél (egy mondat) · brand(ek) · Alapok · ellenőrizhető AC-k · scope és „nem része” · terület · bizonyíték
AC-nként · külső rendszer · kockázat · stack-hatás. Döntési ticketnél (ADR, spike) a „Döntési ticket”
változat mezői. Ami hiányzik, vagy nem ellenőrizhető („jól működik”), az hiba.

## 3. Frissesség és ellentmondás a repóval

Előbb `git fetch origin`, aztán mindig a friss `origin/demo`-hoz (hotfixnél `origin/main`) mérj, ne a saját
ághoz.

1. **Ticket dátuma óta változott döntések:** `git log origin/demo --first-parent --since=<ticket létrehozása>
   -m --name-status -- docs/adr .agents/skills/kg-stack/SKILL.md AGENTS.md` (hotfixnél `origin/main`). Az
   elfogadás dátuma a merge commité (`--first-parent`), nem az ADR commitjáé: a ticket után merge-elt, de
   előtte commitolt ADR is megjelenik. Minden új ADR-t vesd össze a ticket állításaival (pl. a ticket
   Vercelről beszél, közben egy ADR a Workersre váltott).
2. **A ticket állításai a kóddal:** minden fájlra, csomagra, hibakódra, parancsra, konvencióra, amit a
   ticket megnevez, `git grep` vagy fájlolvasás. Eltérés = finding (pl. a ticket egy hibakódot ír, a kód
   másikat használ).
3. **Kényszerek:** a `kg-stack` táblázat sorai és az elfogadott ADR-ek, amelyeknek az eredmény nem
   mondhat ellent, hacsak nem váltja fel őket kifejezetten (`kg-stack` 3.). A nyitott döntésre épülő ticket
   nem indulhat, amíg a döntés nincs meg.
4. **Függőségek:** a linkelt ticketek állapota (lezárt-e, amire épít; nem blokkolja-e önmagát).
5. **Külső rendszer:** ha az AC külső rendszer viselkedésére épül (Woo REST-hitelesítés, gateway,
   Cloudflare), a ticketben legyen megnevezve, hogyan ellenőrizzük valódi ellen. Ha nincs, az AC
   „fixture-zöld, valódi-ismeretlen” kockázat; jelezd, és javasolj ellenőrző AC-t.

## 4. Eredmény

Rövid, magyarul, a chaten (hosszú anyag fájlba):

- **Verdikt:** kész indulásra · javítani kell, mielőtt indulna · döntés kell előbb.
- **Findingok** ticketenként: mit állít a ticket, mi ellentmond (fájl:sor vagy ADR-szám), javítás.
- **Átfogalmazás-javaslat:** a ticket új szövege a sablon szerint, a változások jelölve (mi változott és
  miért). Az eredeti szöveg nem vész el: a javaslat külön blokk.
- **Nyitott kérdések** opciós kérdésként (2-4 opció, a javasolt elöl), ha dönteni kell.

## 5. Jira-írás (csak kifejezett kérésre)

Az átfogalmazás alkalmazása külső rendszerbe írás: csak a felhasználó kifejezett kérésére, és nem az
assignee feje felett: ha a ticket nem a felhasználóé, ő egyeztet a felelőssel. Menete: az eredeti leírás
egy kommentbe kerül („Átfogalmazás előtti szöveg”), utána a leírás frissül, a változásokat egy komment
indokolja. Státuszt és assignee-t nem módosítasz.

## Amit ne csinálj

- Ne találj ki hiányzó AC-t: kérdezz, vagy jelöld javaslatnak.
- Ne írd át a ticket célját: a scope-ot a felelős dönti el.
- Ne tekints egy ticket állítását ténynek, amíg a repóban nem ellenőrizted.
