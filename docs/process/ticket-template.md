# Agent-ready Jira-ticket sablon (KG)

Ezt másold a Jira-ticket leírásába. Egy ticket akkor „agent-ready” (Definition of Ready), ha minden mező ki
van töltve; a `kg-ticket-to-pr` skill ebből dolgozik.

---

**Cél:** <egy mondat: ki, mit, miért - a vásárló vagy a shop-admin szemszögéből>

**Brand(ek):** <gamer | mind | …>

**Elfogadási kritériumok**

- [ ] <ellenőrizhető állítás>
- [ ] <hibaeset: mit lát a felhasználó, milyen hibakóddal>
- [ ] <mobilon is működik>

**Scope:** <mi tartozik bele>
**Nem része:** <mi nem>

**Terület:** <pl. features/add-to-cart, packages/woo-client, apps/jobs supplier-feed-sync> (ha nem ismert:
a `kg-architecture` javasol)

**Bizonyíték:** <teszt / screenshot előtte-utána / e2e / valódi rendelés a lokális Woo-n>

**Kockázat:** <fizetés, auth, brand-elkülönítés, beszállítói rendelés, számlázás, személyes adat - vagy „nincs”>

**Stack-hatás:** <nincs | új szolgáltatás vagy csere → `kg-stack` folyamat, ADR kell>

---

## Definition of Done

- A quality gate zöld (typecheck, lint, Steiger, teszt, build), helyben és a CI-ban.
- UI-változásnál előtte-utána screenshot a PR-ban, minden érintett brandre.
- Új hibakód a katalógusban.
- Független AI review a kockázati szint szerint, és a másik fejlesztő jóváhagyása.
- Ha stack-változás volt: ADR + `kg-stack` + `AGENTS.md` frissítve.
- „Done” csak kiadás (`vX.Y.Z`) és élő ellenőrzés után.
