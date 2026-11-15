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
| `issue-invoice` | Woo webhook: fizetett rendelés | Billingo-számla API v3-mal (`vendor_id` idempotenciával), számlalink visszaírása a rendelésbe |
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

A számlázás a Trigger.dev `issue-invoice` taskjában fut majd (`apps/jobs/src/adapters/billingo/`, `KG-16`), a Billingo API
v3-mal (ADR-0015); Woo Billingo-plugint nem használunk:

- **Idempotencia és bizonytalan eset:** Trigger.dev kulcs (`issue-invoice:<brand>:<orderId>`) és Billingo `vendor_id`
  egyedi kulcs; bizonytalan `POST /documents` válasz után előzetes ellenőrzés a `GET /documents/vendor/{vendor_id}`
  végponton. Ha maga a `vendor_id` lekérdezés is hibás vagy bizonytalan, nincs vak automatikus újralétrehozás:
  a rendelés `invoice_uncertain` állapotba kerül, riasztás megy, és kézi ellenőrzés következik.
- **Céges adatok és tételek:** a Woo REST v3-ból beolvasott `kg-headless` HPOS-mezőkkel (`_billing_is_company`,
  `_billing_company_name`, `_billing_tax_number`), a kedvezményeket negatív tételként átadva.
- **Kimenet és hibakezelés:** a `billingo_document_id` és a PDF/elérési link visszaírása a Woo-rendelésbe;
  aszinkron PDF-generálásnál késleltetett újrapróba; brandenként `billingo.blockId` és `billingo.apiKeyEnv` a
  `packages/brand-config`-ban, a kulcs értéke pedig a Trigger.dev env-ben (`KG-16`).
- **Sztornó:** csak kézi művelettel történhet (Billingo felületen vagy külön admin parancsból), vak automatikus
  sztornó nincs.

## Meilisearch

Brandenként egy index (`products_<brand>`). A dokumentum a Store API termékadataiból készül (név, slug, ár
minor unitban, kategóriák, attribútumok, készletjelzés, kép). A keresés kizárólag a Next.js BFF-en keresztül
megy: a böngésző nem kap keresőkulcsot, a BFF szerveroldalon indexre korlátozott search-only kulcsot használ,
az admin kulcs pedig csak a jobokban van. A kereső saját Docker konténerként fut majd a backend VPS-en
belső/védett Cloudflare Tunnel mögött (ADR-0012).
