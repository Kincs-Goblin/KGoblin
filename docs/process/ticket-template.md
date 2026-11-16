# Agent-ready Jira-ticket sablon (KG)

Ezt másold a Jira-ticket leírásába. Egy ticket akkor „agent-ready” (Definition of Ready), ha minden mező ki
van töltve; a `kg-ticket-to-pr` skill ebből dolgozik, a `kg-ticket-refine` skill pedig ellenőrzi és
szükség esetén átfogalmazza.

---

**Cél:** <egy mondat: ki, mit, miért - a vásárló vagy a shop-admin szemszögéből>

**Brand(ek):** <gamer | mind | …>

**Alapok:** <a ticket írásának dátuma, és a rá érvényes döntések: ADR-számok, `kg-stack` sorok, a kód
mintái, amelyekre épít (pl. „2026-11-12, ADR-0008, hibakódok: `kg-architecture`”)>

**Elfogadási kritériumok**

- [ ] <ellenőrizhető állítás>
- [ ] <hibaeset: mit lát a felhasználó, milyen hibakóddal>
- [ ] <mobilon is működik>

**Scope:** <mi tartozik bele>
**Nem része:** <mi nem>

**Terület:** <pl. features/add-to-cart, packages/woo-client, apps/jobs supplier-feed-sync> (ha nem ismert:
a `kg-architecture` javasol)

**Bizonyíték:** <AC-nként: teszt / screenshot előtte-utána / e2e / valódi rendelés a lokális Woo-n>

**Külső rendszer:** <melyik valódi rendszer viselkedésére épül a megoldás (Woo REST-auth, gateway, beszállító,
Cloudflare), és hogyan ellenőrizzük valódi ellen (lokális Docker-Woo, sandbox) - vagy „nincs”>

**Kockázat:** <fizetés, auth, brand-elkülönítés, beszállítói rendelés, számlázás, személyes adat - vagy „nincs”>

**Stack-hatás:** <nincs | új szolgáltatás vagy csere → `kg-stack` folyamat, ADR kell>

---

## Döntési ticket (ADR, spike)

Ha a ticket célja egy döntés, nem kód, a fenti mezők helyett ezek kellenek:

**Cél:** <melyik döntés, melyik későbbi ticketet blokkolja>

**Kényszerek:** <már elfogadott ADR-ek és `kg-stack` sorok, amelyeknek az eredmény nem mondhat ellent,
hacsak nem váltja fel őket kifejezetten (`kg-stack` 3.)>

**Opciók:** <legalább 2, mindegyiknél költség, lock-in, üzemeltetés, a meglévő döntésekkel való viszony>

**Döntéshozó:** <ki dönt, ki hagyja jóvá; az ADR „Döntéshozók” sorába csak ő kerülhet>

**Kész, ha:**

- [ ] Opciós kérdés feltéve, a válasz (ki, hol) az ADR „Jóváhagyás” sorában.
- [ ] ADR + `kg-stack` + `AGENTS.md` + érintett skillek frissítve (`kg-stack` folyamat).
- [ ] Az ADR minden, a repóra vonatkozó állítása ellenőrizve (fájl, parancs), nincs benne ellentmondás.
- [ ] A követő ticket(ek) (ahol az eredmény megvalósul) megnevezve.

## Frissesség

A ticket írásakor érvényes döntések elavulhatnak, mielőtt valaki elkezdi. Munka előtt a `kg-ticket-refine`
összeveti a ticketet a ticket dátuma óta elfogadott ADR-ekkel és a mai kóddal. Ha a ticket állítása
ellentmond a repónak, a ticketet kell javítani (átfogalmazás-javaslat, a Jira-írás csak kifejezett kérésre),
nem csendben a repónak ellentmondó megoldást építeni.

---

## Definition of Done

- A quality gate zöld (typecheck, lint, Steiger, teszt, build), helyben és a CI-ban.
- Minden elfogadási kritériumhoz bizonyíték vagy kimondott „nem ellenőrzött” a PR-ban (AC → bizonyíték).
- Ami külső rendszer viselkedésére épül és nem futott valódi ellen, az nem „kész”: vagy lefut, vagy follow-up
  ticket és kimondott kockázat.
- UI-változásnál előtte-utána screenshot a PR-ban, minden érintett brandre.
- Új hibakód a katalógusban.
- Független AI review a kockázati szint szerint, és egy fejlesztő kifejezett „mehet”-je a merge-hez.
- A PR-leírás a head SHA-val együtt él: új bizonyíték (pl. utólagos futtatás) után frissül (a Jira-komment
  kérésre).
- Ha stack-változás volt: ADR + `kg-stack` + `AGENTS.md` frissítve.
- „Done” csak kiadás (`vX.Y.Z`) és élő ellenőrzés után.
