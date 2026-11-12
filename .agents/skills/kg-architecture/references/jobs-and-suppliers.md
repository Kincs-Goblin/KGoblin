# Háttérjobok és beszállítók (`apps/jobs`)

Trigger.dev taskok, lapos szerkezetben (UI nincs, FSD nem kell):

```
apps/jobs/src/
  trigger/     task-definíciók: vékonyak, összerakják a domaint és az adaptereket
  domain/      tiszta függvények és portok (interfészek): leképezés, árazás, diff, hibakódok
  adapters/    külső rendszerek a portok mögött: suppliers/<név>, woo, billingo, meilisearch, resend, meta
```

## Tervezett taskok

| Task | Indító | Mit csinál |
|---|---|---|
| `supplier-feed-sync` | ütemezett, brandenként és beszállítónként | feed letöltése → Zod → leképezés → SKU szerinti diff → Woo batch upsert (REST v3) → reindex → revalidálás |
| `forward-order` | Woo webhook: fizetett rendelés | rendelés továbbítása a beszállítónak, a beszállítói azonosító visszaírása a Woo-rendelésbe |
| `sync-order-status` | ütemezett vagy beszállítói webhook | szállítási státusz és csomagkövetési szám visszaírása, email a vásárlónak |
| `issue-invoice` | fizetett rendelés (ha a Billingo-bekötés job-alapú lesz) | Billingo-számla, a számla linkje a rendelésbe |
| `send-email` | rendelés-események | React Email sablon → Resend |
| `reindex-search` | termékváltozás | Meilisearch-dokumentum frissítése a brand indexében |
| `merchant-feed` | ütemezett | Google Merchant feed generálása brandenként |
| `meta-capi` | rendelés-események | szerveroldali Purchase esemény, `event_id` a pixel-dedupához |

## Szabályok

- **Idempotencia:** minden task idempotencia-kulccsal indul, brand-előtaggal: `forward-order:<brand>:<orderId>`.
  Ugyanaz a webhook kétszer érkezik → egyszer fut le.
- **Pénz- és rendelésmozgásnál nincs vak újrapróba.** Ha a beszállítói API válasza bizonytalan (időtúllépés
  a küldés után), a rendelés `forward_uncertain` állapotba kerül, riasztás megy, és kézi ellenőrzés vagy
  kézi újrapróba következik. Biztosan meg nem történt hívásnál (pl. kapcsolódási hiba) mehet az automatikus
  újrapróba backoff-fal.
- **Port + adapter + fake:** minden beszállító ugyanazt a `SupplierPort`-ot valósítja meg (`fetchCatalog`,
  `placeOrder`, `getOrderStatus`). A tesztek és a lokális fejlesztés a fake adapterrel futnak; a valódi
  beszállítót lokálisan csak kifejezett kérésre hívjuk.
- **Stabil kulcs:** a beszállítói SKU vagy EAN köti össze a feedet és a Woo-terméket (Woo meta mezőben).
- **Árazás:** a beszállítói árból az eladási árat a `domain/pricing` számolja (árrés, kerekítés), és a Woo-ba
  már a végleges ár kerül. A frontend nem számol árat.
- **Feed-minőség:** a hibás sorokat ne dobd el csendben; összesítő riport a futás végén (hány új, módosult,
  kihagyott, és miért), Sentry-figyelmeztetés küszöb felett.
- A titkok (beszállítói API-kulcs, Woo consumer secret, Billingo-kulcs) a Trigger.dev env-ben vannak, nem a
  kódban.

## Billingo

Nyitott döntés, hogy a Woo Billingo-pluginja vagy egy `issue-invoice` task állítja ki a számlát (`kg-stack`).
Amíg nincs döntés, ne építs olyat, ami az egyiket kizárja. Mindkét esetben: a számla a fizetett állapotból
indul, idempotensen, és sztornó csak kézi művelettel történhet.

## Meilisearch

Brandenként egy index (`products_<brand>`). A dokumentum a Store API termékadataiból készül (név, slug, ár
minor unitban, kategóriák, attribútumok, készletjelzés, kép). A keresési API-kulcs csak search-jogú, és
indexre korlátozott; az admin kulcs csak a jobokban van.
