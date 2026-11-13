# Változásnapló

A formátum a [Keep a Changelog](https://keepachangelog.com/hu/1.1.0/) mintáját követi, a verziók
[SemVer](https://semver.org/lang/hu/) szerint. A folyamat: `kg-release` skill.

## [0.1.0] - 2026-11-13

### Új

- Gamer storefront Hearthstone-hangulatú témával: főoldal kiemelt termékekkel, kategóriák és ritkaság szerinti
  kínálat (KG-5).
- Katalógus rendezéssel és akciós szűrővel, kategória- és termékoldal, akciónál az elmúlt 30 nap legalacsonyabb
  árával (KG-5).
- Kosár drawer: kosárba tétel, darabszám, törlés; a kosár a böngészőben megmarad. A pénztár még nem
  elérhető (KG-5).

### Belső

- Headless WooCommerce backend (`kg-headless` plugin): Store API-kiterjesztés az Omnibus-árral, a pénztár
  szerveroldali magyar céges adószám- és ÁSZF-ellenőrzése a későbbi storefront-pénztárhoz (KG-4).
- pnpm + Turborepo monorepo, `brand-config` és `woo-client` csomag, FSD-szerkezet, GitHub Actions CI (KG-5).
- Többbrandes lokális Docker-környezet (MariaDB, Redis, HPOS) gamer tesztadatokkal (KG-4).
- Fejlesztési folyamat: merge-kapu, ticketenkénti worktree, Tinati-alapú demo-kiadás (ADR-0007) (KG-5).
