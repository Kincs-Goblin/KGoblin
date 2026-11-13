---
description: Ticketág, version-ág vagy main → demo PR ügyféltesztre (merge commit)
---

1. Olvasd be: `.agents/skills/kg-git-workflow/SKILL.md` („demo ág”) és `.agents/skills/kg-release/SKILL.md` (4. lépés).
2. Kérdezd meg, melyik ágak menjenek a demóra. Előtte legyen meg a helyi release-teszt (`kg-release` 1-3.).
3. Ha a `demo`-ból hiányzik a `main`, előbb `main` → `demo` szinkron PR; utána ticketenként PR, az alap ticket a ráépülő előtt.
4. PR-nyitás és merge csak kifejezett kérésre. A `demo`-ra nincs közvetlen push, és a `demo` nem megy ticketágba.
