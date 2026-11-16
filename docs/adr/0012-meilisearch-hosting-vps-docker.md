# ADR-0012: Meilisearch hosting - saját Docker a backend VPS-en (BFF-eléréssel)

- Állapot: elfogadott (`ricsmond12` választása 2026-11-15 / 2026-11-16; `SMark2256` a [PR #15](https://github.com/Kincs-Goblin/KGoblin/pull/15) review-ban a tartalmi irányt jóváhagyta, véglegesítés a merge-hez adott „mehet”-tel)
- Dátum: 2026-11-15 (frissítve: 2026-11-16)
- Döntéshozók: SMark2256, ricsmond12
- Ticket: KG-34

## Kontextus

- A `kg-stack` „Keresés hosting” sora nyitott volt (Meilisearch Cloud vagy saját), és a `KG-10` (1. mérföldkő, termékkeresés) megvalósítása előtt le kell zárni.
- Az ADR-0001 már rögzítette a Meilisearch keresőmotort brandenként külön `products_<brand>` indexekkel, valamint a BFF-elvet (a böngésző nem hívja közvetlenül a backend szolgáltatásokat); az ADR-0008 pedig a backendhez a saját VPS + Docker Compose + Cloudflare Tunnel infrastruktúrát választotta.
- Követelmények: EU-adatrezidencia, szigorú BFF-elvű kulcs- és hozzáférés-kezelés (`KG-10`), megbízható mentés és alacsony induló költség.

## Döntés

- A Meilisearch saját Docker konténerként fut majd a meglévő backend VPS-en (a `docker-compose.yml` éles változatában), Cloudflare Tunnel mögött, **kizárólag szerveroldali BFF-eléréssel** (belső/védett aldomainen, Cloudflare Access / token-védelemmel; nem lesz nyilvános böngészőből hívható keresővégpont).
- A keresőkonténer verzióját fix képtaggel rögzítjük; a lokális fejlesztéshez ugyanaz a konténer a `KG-10` ticketben kerül majd felvételre a gyökér `docker-compose.yml`-be.
- Elérési és kulcskezelési modell: a böngésző kizárólag a Next.js storefront BFF-rétegén (server action / route handler / RSC) keresztül keres, ezért **a böngésző nem kap Meilisearch API-kulcsot vagy tokent**. A Next.js szerver indexre korlátozott (`products_<brand>`) search-only kulccsal hívja a Meilisearchot; az admin/master kulcs kizárólag a Trigger.dev jobokban (`apps/jobs`) és a VPS környezeti változóiban szerepelhet.

## Következmények

- **Előnyök:** $0/hó extra SaaS-költség az indulásnál; EU-adatrezidencia a VPS régiójában; nincs böngészőben tárolt kulcs vagy nyilvánosan kitett kereső-API támadási felület; a keresőkonténer verziója lokálisan és élesben egységes lesz (`KG-10`-től); nulla lock-in (egy `MEILISEARCH_HOST` / env-cserével később bármikor átrakható Meilisearch Cloudra vagy külön VPS-re).
- **Üzemeltetés és későbbi feladatok (`KG-10`, `KG-20`):**
  - a Meilisearch `dump`/`snapshot` mentése bekerül a VPS napi mentési és visszaállítási tervébe;
  - a VPS RAM-méretezésénél tartalékkal kell számolni a keresőindexhez (néhány ezer-tízezer terméknél ~256-512 MB RAM);
  - a `KG-10` hozza létre a lokális `docker-compose.yml` szolgáltatást és a Next.js BFF kereső klienst, a `KG-20` pedig a Cloudflare Tunnel + Access belső védelmet állítja be élesben.
- Frissítve: `kg-stack` („Keresés hosting” sor), `AGENTS.md` („Stack röviden”), `docs/project-plan.md` („Nyitott döntések”), `.agents/skills/kg-architecture/references/jobs-and-suppliers.md` („Meilisearch”).

## Mérlegelt alternatívák

| Alternatíva | Miért nem |
| --- | --- |
| Közvetlen böngészős elérés (nyilvános `search.<domain>` + search-only kulcs / tenant token) | Alacsonyabb késleltetés gépelés közben, de nyilvános támadási felületet, külön Cloudflare WAF/rate limit hangolást és kliensoldali kulcs/token-kezelést igényel; ütközik a projekt BFF-elvével |
| Meilisearch Cloud (`FRA` Frankfurt vagy `PAR` Párizs) | Nulla üzemeltetés és beépített search analytics, de fix ~$20-30/hó költség már az első naptól, miközben a meglévő VPS-en extra díj nélkül elfér és később bármikor átállítható |
| Külön dedikált kis Docker VPS csak a Meilisearchnek (~$4-5/hó) | Elszigeteli az erőforrásokat a WP-től, de plusz egy külön szerver karbantartását és frissítését hozza be az induláskor; csak növekedő terhelésnél indokolt |
