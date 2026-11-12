# Multi-brand

Egy Next app, több brand. Minden brandnek saját domainje, arculata, szövegei és saját WooCommerce-példánya
van. Az első brand a gamer shop; egy új brand bevezetése **config + téma + Woo-példány**, kódmásolás nélkül.

## Brand feloldása

1. `proxy.ts`: a `Host` headerből a `packages/brand-config` domainlistája alapján megkeresi a brandet, és a
   kérést átírja (rewrite) `/<brand>/<eredeti útvonal>`-ra. Ismeretlen host: 404 (`BRAND.UNKNOWN_HOST`),
   nem egy „alapértelmezett” brand (fail-closed).
2. Az `app/[brand]/layout.tsx` a `brand` paraméterből tölti a configot, és a `src/app` providerein át adja
   tovább (téma, szövegek, analytics ID-k).
3. Szerveroldali kód a brandet paraméterként kapja (`getProduct(brand, slug)`), nem globális állapotból.
4. Lokálisan: `<brand>.localhost:3000` aldomainek (a brand `domains` listájában szerepelnek). `?brand=` váltó
   nincs; ha kell, csak development módban, külön döntéssel.

## Brand-config (`packages/brand-config`)

Brandenként egy típusos objektum (Zod-dal validálva build időben):

| Mező | Példa | Megjegyzés |
|---|---|---|
| `id` | `gamer` | stabil, kisbetűs, URL-ben és cache-tagben is szerepel |
| `domains` | `["<gamer-domain>.hu", "www.<gamer-domain>.hu"]` | production és demo domainek |
| `woo.baseUrlEnv` | `WOO_GAMER_URL` (az env-változó neve, nem az értéke) | a titkok (`WOO_GAMER_CONSUMER_KEY/SECRET`, `WOO_GAMER_WEBHOOK_SECRET`) csak env-ben |
| `locale`, `currency` | `hu-HU`, `HUF` | |
| `theme` | tokenek: szín, tipográfia, radius, árnyék | CSS-változókká alakul, a Tailwind ezekre hivatkozik |
| `texts` | brandhang, SEO-alapszövegek | a slice-szövegek felülírhatók brandenként |
| `payments` | `["stripe", "barion", "simplepay"]` | csak megjelenítési sorrend és engedélyezés; a forrás a Woo |
| `analytics` | Meta pixel ID, PostHog projekt, GA/Merchant ID | publikus ID-k; a CAPI-token env-ben. Még nincs a sémában: a mérés bekötésekor kerül be |
| `search` | Meilisearch index neve | `products_<brand>` |

## Elkülönítés (kockázatos terület)

- Cache-tag, Meilisearch-index, cookie, Trigger.dev idempotencia-kulcs: **mindig brand-előtaggal**.
- Egyik brand Woo-tokenje vagy kosártokenje soha nem mehet másik brand Woo-jához. A `createWooClient(brand)`
  az egyetlen belépési pont, és a brandből veszi a végpontot és a titkot.
- Analytics és CAPI-esemény a saját brand pixeléhez megy.
- E2e és vizuális ellenőrzés minden érintett brandre lefut.

## Téma

- Design tokenek az első naptól: `--color-primary`, `--radius`, `--font-heading` stb. A komponensben hex
  szín vagy brandre utaló osztálynév nem lehet.
- A shadcn komponensek a tokenekre hivatkoznak; brandenkénti eltérés variánsként vagy tokenként, nem
  elágazó kódként.
- Az arculati színek forrása a brand arculati kézikönyve vagy Figma-változói, nem képernyőkép.

## Új brand bevezetése (checklist)

1. ADR, ha a brand eltér a mintától (pl. más pénznem vagy nyelv) - különben elég a ticket.
2. Woo-példány (a hosting-döntés szerint), HPOS, `kg-headless` plugin, gateway pluginek, Billingo.
3. `packages/brand-config`: új bejegyzés; env-változók a Vercelben és a Trigger.dev-ben.
4. Domain a Vercel projekthez; demo-domain.
5. Meilisearch-index, Merchant feed, Meta pixel és CAPI, PostHog projekt.
6. Beszállítói adapterek hozzárendelése a brandhez (`apps/jobs`).
7. E2e a brandre, aztán a release folyamat szerint ki.
