# apps/jobs - Trigger.dev háttérjobok

Trigger.dev v4 (`@trigger.dev/sdk`) háttérjobok lapos szerkezetben (nincs UI, FSD nem kell):

| Mappa / Fájl | Tartalom |
|---|---|
| `trigger.config.ts` | Trigger.dev projektkonfiguráció, retry-szabályok és központi `onFailure` hibajelentő hook |
| `src/trigger/` | task-definíciók (`brand-heartbeat.ts`); vékonyak, a domaint és az adaptereket rakják össze |
| `src/domain/` | tiszta függvények és portok: env-séma (`env.ts`), idempotencia és heartbeat (`heartbeat.ts`), hibakód-katalógus (`errors/`) |
| `src/adapters/` | külső rendszerek a portok mögött: telemetria/Sentry (`telemetry.ts`), `suppliers/<név>`, `woo`, `billingo`, `meilisearch`, `resend`, `meta` |

Tervezett taskok, idempotencia, újrapróba és beszállítói szabályok:
`.agents/skills/kg-architecture/references/jobs-and-suppliers.md`.

## Futtatás és deploy

1. Másold le az `.env.example` fájlt `.env.local` néven, és állítsd be a `TRIGGER_PROJECT_ID` (valamint dev/deploy módban a `TRIGGER_SECRET_KEY`) értéket.
2. Lokális fejlesztés (Trigger.dev dev CLI):
   ```bash
   pnpm --filter @kg/jobs dev
   ```
3. Tesztek és típusellenőrzés:
   ```bash
   pnpm --filter @kg/jobs test
   pnpm --filter @kg/jobs typecheck
   ```
4. Éles deploy (a `main` ágról vagy kézi lépésként):
   ```bash
   pnpm --filter @kg/jobs deploy
   ```
