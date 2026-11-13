---
name: kg-architecture
description: KGoblin architektúra-döntések - FSD 3. szint Next.js App Routerrel, hova kerüljön az új kód, Woo-adatréteg (Store API, REST v3, Zod, cache-tagek, webhookok), multi-brand (domain → brand), háttérjobok és beszállítói adapterek, hibakódok. Használd, ha nem egyértelmű, hova kerüljön egy kód, ha új szeletet, oldalt, integrációt vagy jobot tervezel, ha Woo-hívást írsz, ha brandfüggő logika kell, vagy ha architektúra-review-t kérnek. Triggerek: „hova tegyem”, „tervezd meg”, „új oldal”, „új integráció”, „új beszállító”, „architektúra review”.
---

# kg-architecture

Döntések: `kg-stack`. Részletek a `references/` fájlokban; csak azt olvasd be, amire szükséged van.

| Fájl | Mikor |
|---|---|
| `references/placement.md` | új kód helyének eldöntése, szeletlista, Next + FSD összekötés |
| `references/woo-integration.md` | bármilyen Woo-hívás, kosár, checkout, fizetés, webhook, cache |
| `references/multi-brand.md` | brandfüggő logika, téma, env, domain, brand-elkülönítés |
| `references/jobs-and-suppliers.md` | Trigger.dev task, beszállítói adapter, rendelés-továbbítás, Billingo, Meilisearch |

## 1. Alapelvek (minden rétegre)

- **A szerver a forrás.** Árat, kedvezményt, szállítási díjat, végösszeget és készletet a Woo ad; a
  frontend csak megjelenít. Pénz soha nem JS float: a Store API minor unitban adja, úgy is kezeljük.
- **BFF.** A böngésző nem hívja a WordPresst. Minden Woo-hívás a Next szerverén fut (RSC, server action,
  route handler); a kosártoken httpOnly cookie-ban van.
- **REST v3 csak szerveren.** A consumer key/secret `server-only` modulban él, `NEXT_PUBLIC_` soha.
- **Zod minden határon:** Woo-válasz, webhook-payload, beszállítói feed, űrlap-input.
- **A brand kontextus, nem konstans.** Brandfüggő értéket (Woo URL, szín, szöveg, fizetési mód, pixel ID)
  csak a brand-configból veszel. Brand-ID-t hardcode-olni tilos.
- **Stabil üzleti kulcs.** Beszállítói terméknél SKU/EAN a kulcs, nem a Woo belső ID. Listában a kulcs az
  `id`, nem a név.
- **Fail-closed vagy fail-open, tudatosan.** Ha nincs fizetési mód a válaszban: semmit nem kínálunk fel
  (fail-closed). Ha a készletjelzés hiányzik: nem tiltunk, a checkout úgyis ellenőriz (fail-open). A
  döntést kommentben vagy a tervben írd le.
- **Mellékhatás nem a kérés közepén.** Email, beszállítói hívás, számla, CAPI-esemény Trigger.dev taskban
  fut, idempotencia-kulccsal és újrapróbával.

## 2. FSD 3. szint röviden

Rétegek felülről lefelé: `app → pages → widgets → features → entities → shared` (`apps/web/src`).

- Egy réteg csak alacsonyabb rétegből importálhat. Két szelet ugyanabban a rétegben nem importálja
  egymást; a közös rész lejjebb kerül, vagy feljebb kötik össze.
- Szeleten kívülről csak a szelet `index.ts`-ét (public API) szabad importálni. Szerveroldali export külön
  belépési pontban: `index.server.ts` (`import "server-only"`), hogy kliens ne húzza be.
- Szegmensek: `ui/`, `model/`, `api/`, `lib/`, `config/`. A `shared` szegmensei: `ui`, `lib`, `api`, `config`.
- A Next `apps/web/app/` mappája **csak routing**: a `page.tsx` a `src/pages/<szelet>`-ből re-exportál, a
  `route.ts` vékony (validál, meghív egy függvényt, választ ad). Üzleti logika nem lehet benne.
- Ellenőrzés: Steiger (minden szabály `error`) és ESLint import-szabály. Szintváltás csak `kg-stack`
  folyamattal.

## 3. Új kód tervezése - kimenet kódolás előtt

```
Hely: src/features/add-to-cart/ (api/add-to-cart.action.ts, ui/AddToCartButton.tsx, model/) + index.ts
Függ: entities/cart, entities/product, shared/api/woo
Adat: Store API POST /cart/add-item, Cart-Token a httpOnly cookie-ból; a kosár nem cache-elt (no-store)
Hibakódok: CART.OUT_OF_STOCK (új), WOO.UNAVAILABLE (meglévő)
Brand: minden brandre azonos; a gomb szövege a brand texts-ből
Teszt: action unit teszt MSW-vel (siker, készlethiány, Woo 5xx), e2e a kosárba tételre
```

Ha egy kód két rétegbe is illene, az alacsonyabbat válaszd, ha nincs benne felsőbb rétegre utaló tudás.

## 4. Hibakódok

- Formátum `DOMAIN.REASON` (pl. `CART.OUT_OF_STOCK`, `CHECKOUT.PAYMENT_DECLINED`, `WOO.UNAVAILABLE`,
  `WOO.INVALID_RESPONSE`, `BRAND.UNKNOWN_HOST`, `SUPPLIER.FEED_INVALID`). A kód stabil szerződés, a szöveg változhat.
- A katalógus és a közös `AppError` osztály az `apps/web/src/shared/lib/errors/catalog.ts` (`shared/lib/errors`)
  és az `apps/jobs/src/domain/errors/catalog.ts` (`apps/jobs/src/domain/errors`) fájlokban van; minden kódnak
  van HTTP-státusza, `retryable` jelzője és felhasználói szövege. Új kód a katalógusba kerül.
- Felhasználó felé emberi üzenet, soha nyers Woo-hibaszöveg vagy stack trace. Üzleti szabály sértése: 409.
- Token, jelszó, kártyaadat, teljes cím soha nem kerül logba vagy Sentrybe.

## 5. Review-ellenőrzőlista

Rétegszabály és public API · Woo-hívás csak szerveren, Zod-dal · nincs kliensoldali ár- vagy összegszámítás ·
brand a kontextusból, cache-tag brand-előtaggal · titok nem szivárog a kliensre · mellékhatás jobban,
idempotensen · hibakód a katalógusból · teszt az invariánsra. Minden findinghoz fájl:sor és javaslat.

## Amit ne csinálj

- Ne vezess be új réteget, szegmenst vagy globális állapotkezelőt (`kg-stack` folyamat nélkül).
- Ne hívd a WP-t a böngészőből, és ne tedd ki a WP domainjét a kliensoldali kódba.
- Ne másold a Woo-logikát (ár, adó, kupon, készlet) a frontendre „hogy gyorsabb legyen”.
- Ne írj brandenként elágazó `if (brand === "…")` kódot; az eltérés config vagy téma legyen.
