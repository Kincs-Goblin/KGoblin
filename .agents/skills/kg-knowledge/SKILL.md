---
name: kg-knowledge
description: Hogyan és hová rögzíts tudást a KGoblin projektben, hogy a következő session (bármelyik fejlesztőé, bármelyik agent-eszközben) ott találja meg - repó (AGENTS.md, skillek, ADR, README) vagy személyes agent-memória. Használd, ha azt mondják, „jegyezd meg”, „emlékezz erre”, „vedd fel”, ha egy nagyobb feladat végén állapotot kell menteni, vagy el kell dönteni, hová kerüljön egy tény.
---

# kg-knowledge

A cél: a jövőbeli session **ott** találja meg a tényt, ahol szüksége lesz rá, és csak egyszer.

## 1. Az alapprobléma

Két fejlesztő, akár különböző agent-eszközök, több gép. Az agent-memória **személyes, eszköz- és
géphez kötött**:

- minden eszköz a saját helyén tárol (helyek eszközönként: `docs/process/agent-adapters.md`); egy eszköz memóriáját a másik nem látja;
- egyes eszközöknél a memória az indító mappához kötődik, így egy worktree-session mást lát, mint a fő
  checkoutból indított;
- a másik fejlesztő agentje **semmit** nem lát a te memóriádból.

Következmény: **ami a csapatnak vagy a másik agentnek is kell, az a repóba megy.** A memória csak arra
való, ami a te munkamódodról szól.

## 2. Döntési fa: hová kerüljön?

| A tény jellege | Helye |
|---|---|
| Stack-döntés, új szolgáltatás, csere | `kg-stack` + ADR a `docs/adr/` alatt (kötelező folyamat) |
| Csapatszabály, ami minden munkára érvényes | `AGENTS.md` (rövid maradjon, ≤ 150 sor) |
| Egy terület működése, mintája | az érintett skill (`.agents/skills/kg-*`) vagy a `references/` fájlja |
| Külső rendszer furcsasága (Woo, gateway, Billingo, beszállító) | a kliens vagy adapter README-jének „Ismert furcsaságok” része |
| Termékterv, mérföldkő, scope | `docs/project-plan.md` |
| Egy ticket állapota, félkész munka | a Jira-ticket kommentje (kérésre) vagy a PR leírása |
| A te személyes preferenciád (stílus, válaszhossz) | az eszközöd globális agent-fájlja (`docs/process/agent-adapters.md`), csak kérésre |
| Neked szóló, nem csapatszintű tény erről a projektről | agent-memória a **fő checkout** poolja szerint |
| Amit a kód, a git log vagy a repó doksija már elmond | **sehová**; ha kérik, kérdezd meg, mi volt benne a nem nyilvánvaló, és azt mentsd |

Ökölszabály: **csapatnak szóló tudás → repó; nekem szóló tudás → memória; kétség esetén → repó.**

Ha a repóba kerül, az is változtatás: a megfelelő ágon, PR-ral megy (`docs/KG-n-…` vagy a feladat PR-ja).

## 3. Memóriafájl formája (fájl-alapú agent-memóriánál)

Egy fájl = egy téma; a fájlnév és a `name` ugyanaz a kebab-case slug.

```markdown
---
name: kg-barion-sandbox-quirk
description: Egysoros összefoglaló - ebből dől el visszahíváskor, releváns-e
metadata:
  type: user | feedback | project | reference
---

A tény, tömören. Dátum mindig abszolút (2026-11-12, nem „tegnap”).

**Why:** miért igaz / miért kérte.
**How to apply:** mit tegyél emiatt.
```

Utána egy sor a pool `MEMORY.md`-jébe: `- [Cím](fajl.md) - rövid horog`, legfeljebb kb. 150 karakter.

## 4. Higiénia

- **Írás előtt keress**, van-e már fájl vagy repóbeli hely a témára; ha van, azt frissítsd.
- Ami kiderült, hogy téves vagy elavult: javítsd vagy töröld (a memóriában és a repóban is).
- Fájlnevet, függvényt, flaget visszahíváskor ellenőrizz a kódban, mielőtt tényként mondod.
- **Titok** (jelszó, API-kulcs, token, consumer secret) soha nem kerül memóriába vagy a repóba.
  Nyilvános teszt kulcs kivétel, jelölve.
- Ügyfél- vagy vásárlói személyes adat sem a memóriába, sem a repóba nem kerül.

## 5. Session végén (nagyobb feladat után)

Röviden mérlegeld: mit kellene tudnia a következő sessionnek (akár a másik fejlesztőének), ami **nincs**
a kódban, a commitban vagy a repó doksijában? Tipikusan: egy döntés és az indoka, egy külső rendszer nem
dokumentált csapdája, mi maradt félkészen. Ami csapatszintű, azt javasold a repóba (PR-ral), a többit
mentsd memóriába. A chaten egy félmondat elég róla.
