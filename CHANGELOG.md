# Változásnapló

A formátum a [Keep a Changelog](https://keepachangelog.com/hu/1.1.0/) mintáját követi, a verziók
[SemVer](https://semver.org/lang/hu/) szerint. A folyamat: `kg-release` skill.

## [0.1.0] - 2026-11-13

### Új

- Gamer storefront Hearthstone-hangulatú témával: főoldal kiemelt termékekkel, kategóriák és ritkaság szerinti
  kínálat (KG-5).
- Katalógus rendezéssel és akciós szűrővel, kategória- és termékoldal, akciónál az elmúlt 30 nap legalacsonyabb
  árával (KG-5).
- Kosár drawer: kosárba tétel, darabszám, törlés; a kosár a böngészőben megmarad (KG-5).
- Headless WooCommerce backend: Store API, magyar céges adószám- és ÁSZF-ellenőrzés a pénztárban, Omnibus
  30 napos legalacsonyabb ár (KG-4).

### Belső

- pnpm + Turborepo monorepo, `brand-config` és `woo-client` csomag, FSD-szerkezet, GitHub Actions CI (KG-5).
- Többbrandes lokális Docker-környezet (MariaDB, Redis, HPOS) gamer tesztadatokkal (KG-4).
- Fejlesztési folyamat: merge-kapu, ticketenkénti worktree, Tinati-alapú demo-kiadás (ADR-0007) (KG-5).
