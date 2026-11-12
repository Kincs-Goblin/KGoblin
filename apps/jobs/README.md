# apps/jobs - Trigger.dev háttérjobok

Állapot: csak mappastruktúra, a scaffold a 0. mérföldkő ticketje.

Lapos szerkezet (nincs UI, FSD nem kell):

| Mappa | Tartalom |
|---|---|
| `src/trigger/` | task-definíciók; vékonyak, a domaint és az adaptereket rakják össze |
| `src/domain/` | tiszta függvények és portok: termék-leképezés, árazás, diff, hibakódok |
| `src/adapters/` | külső rendszerek a portok mögött: `suppliers/<név>`, `woo`, `billingo`, `meilisearch`, `resend`, `meta` |

Tervezett taskok, idempotencia, újrapróba és beszállítói szabályok:
`.agents/skills/kg-architecture/references/jobs-and-suppliers.md`.
