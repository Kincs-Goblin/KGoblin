---
name: kg-council
description: Többmodelles review-zsűri pontozással és körökkel a KGoblin repóban (Claude Opus + Gemini + Claude Sonnet). Használd, ha a felhasználó azt írja, „council”, council-review-t, council-pontszámot vagy többmodelles review-t, iterációt kér - tipikusan kockázatos PR-nál (checkout, fizetés, auth, multi-brand elkülönítés) vagy UI-design értékelésénél.
---

# kg-council

Forrás: a BILDR HUB agent-kit `council` skillje (t3dotgg/tstack), Claude + Gemini felállásra igazítva,
mert a csapat Claude Code-ot és Antigravityt használ.

## Review előtt

Ha csak review-t kértek, minden read-only: nincs javítás se előtte, se utána, csak a findingok és a
pontszámok. A javítás-iteráció csak akkor jön, ha implementálást vagy javítást is kértek. Review előtt
zárd le az ismert hibákat, és futtasd a releváns ellenőrzéseket; a zsűri a friss állapotot kapja.

## Tagok

| Hely | Modell | Elérés |
|---|---|---|
| 1 | Claude Opus (legújabb) | Claude Code / T3 Claude provider |
| 2 | Gemini (legújabb Pro) | T3 provider, `gemini` CLI, vagy Antigravity-session |
| 3 | Claude Sonnet (legújabb) | Claude Code / T3 Claude provider |

„Kis council” = csak az 1. és a 2. hely. Ha a felhasználó más tagot nevez meg, azt használd. Ha egy tag nem
érhető el, jelezd, és ne helyettesítsd csendben. T3 Code-ban: `orchestrator_capabilities`, majd tagonként
egy `delegate_task`, párhuzamosan.

## Brief

- Minden tag ugyanazt a briefet kapja: a kérés, a diff vagy az állapot, a releváns szabályok (`AGENTS.md`,
  `kg-architecture`), és hogy read-only a munka.
- Ne áruld el a célpontszámot; csak őszinte pontszámot kérj.
- **Kódreview fókusz:** ár vagy összeg a kliensen, Woo-hívás a böngészőből, titok a kliens bundle-ben,
  brandek közötti szivárgás (cache-tag, cookie, index), webhook-aláírás, idempotencia és újrapróba
  pénz- vagy rendelésmozgásnál, FSD-sértés.
- **UI-review:** mindig legyen referencia-screenshot (előző verzió + 2-3 versenytárs vagy általatok kedvelt
  gamer shop), pontozás kategóriánként (hierarchia, tipográfia, szín és kontraszt, térköz, konzisztencia,
  mobil), és a referenciákat is pontozzák. Minden körben friss screenshot készül.

## Pontozás és körök

- Tagonként 10-es skála; egy teljes review-menet egy kör. Javítás után új kör.
- Alap kör-plafon: 5. Ha addig nincs meg a cél, állj meg, és jelentsd a pontszámokat, a hiányokat és a
  következő ötletet. A plafont csak a felhasználó emelheti.
- Takarékos mód: a 2. hely egyedül megy, amíg el nem éri a célt, utána jön a többi; a végső körben
  mindenki jóváhagy.

## Jelentés

PR esetén a PR-leírásba (nem kommentbe):

```markdown
## Council review

Körök: 2

| Tag | 1. kör | 2. kör |
| --- | --- | --- |
| Claude Opus | 7/10 | 9/10 |
| Gemini Pro | 8/10 | 9/10 |
| Claude Sonnet | 7/10 | 9/10 |
```

Nem futott tagnál `nem futott`, pontszám nélküli válasznál `nincs pontszám`; pontszámot ne találj ki.
PR nélkül ugyanez a záró üzenetbe.

## Iteráció

Ha javítást is kértek, és egyetértesz a javaslatokkal, javíts, és kérj friss review-t, amíg mindenki
elégedett vagy a plafon el nem fogy. Ahol a tagok nem értenek egyet, dönts, és mondd meg, miért. A
scope-ot tartsd szűken; a review-körök ne hízlalják a PR-t.
