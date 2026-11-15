# ADR-0012: Meilisearch hosting - saját Docker a backend VPS-en

- Állapot: elfogadott
- Dátum: 2026-11-15
- Döntéshozók: SMark2256, ricsmond12
- Ticket: KG-34

## Kontextus

- A `kg-stack` „Keresés hosting” sora nyitott volt (Meilisearch Cloud vagy saját), és a `KG-10` (1. mérföldkő, termékkeresés) megvalósítása előtt le kell zárni.
- Az ADR-0001 már rögzítette a Meilisearch keresőmotort brandenként külön `products_<brand>` indexekkel; az ADR-0008 pedig a backendhez a saját VPS + Docker Compose + Cloudflare Tunnel infrastruktúrát választotta.
- Követelmények: EU-adatrezidencia, indexre korlátozott search-only kulcs vagy tenant token támogatás (`KG-10`), megbízható mentés és alacsony induló költség.

## Döntés

- A Meilisearch saját Docker konténerként fut a meglévő backend VPS-en (a `docker-compose.yml` éles változatában), Cloudflare Tunnel mögött (külön belső/védett aldomainen, Cloudflare WAF és rate limit védelemmel).
- A keresőkonténer verzióját fix képtaggel rögzítjük; lokális fejlesztéshez ugyanaz a konténer fut a gyökér `docker-compose.yml`-ben.
- Kulcskezelés: a böngésző csak a `products_<brand>` indexre korlátozott search-only kulcsot vagy szerveren (BFF) aláírt tenant tokent kaphat; az admin/master kulcs kizárólag a Trigger.dev jobokban (`apps/jobs`) és a VPS környezeti változóiban szerepelhet.

## Következmények

- **Előnyök:** $0/hó extra SaaS-költség az indulásnál; EU-adatrezidencia a VPS régiójában; teljes tenant token és index-korlátozott API-kulcs támogatás; lokálisan és élesben azonos Docker setup; nulla lock-in (egy `MEILISEARCH_HOST` / env-cserével később bármikor átrakható Meilisearch Cloudra vagy külön VPS-re).
- **Üzemeltetés és későbbi feladatok (`KG-10`, `KG-20`):**
  - a Meilisearch `dump`/`snapshot` mentése bekerül a VPS napi mentési és visszaállítási tervébe;
  - a VPS RAM-méretezésénél tartalékkal kell számolni a keresőindexhez (néhány ezer-tízezer terméknél ~256-512 MB RAM);
  - Cloudflare WAF és rate limit védi a nyilvános keresővégpontot a túlterhelés ellen.
- Frissítve: `kg-stack` („Keresés hosting” sor), `AGENTS.md` („Stack röviden”), `docs/project-plan.md` („Nyitott döntések”), `.agents/skills/kg-architecture/references/jobs-and-suppliers.md` („Meilisearch”).

## Mérlegelt alternatívák

| Alternatíva | Miért nem |
| --- | --- |
| Meilisearch Cloud (`FRA` Frankfurt vagy `PAR` Párizs) | Nulla üzemeltetés és beépített search analytics, de fix ~$20-30/hó költség már az első naptól, miközben a meglévő VPS-en extra díj nélkül elfér és később bármikor átállítható |
| Külön dedikált kis Docker VPS csak a Meilisearchnek (~ $4-5/hó) | Elszigeteli az erőforrásokat a WP-től, de plusz egy külön szerver karbantartását és frissítését hozza be az induláskor; csak növekedő terhelésnél indokolt |
