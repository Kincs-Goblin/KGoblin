# ADR-0008: WordPress hosting - VPS + Docker, Cloudflare mögött

- Állapot: elfogadott
- Dátum: 2026-11-13
- Döntéshozók: SMark2256, ricsmond12
- Ticket: KG-29

## Kontextus

- A `kg-stack` „WordPress hosting” sora nyitott volt (menedzselt WP vagy saját VPS + Docker); a
  `project-plan.md` szerint a 0. mérföldkőnél kell dönteni róla.
- Brandenként külön WP + WooCommerce példány fut (ADR-0001). Lokálisan ez már működik a gyökér
  `docker-compose.yml`-lel: MariaDB 10.11, Redis 7, `wordpress:php8.3-apache` brandenként, a `kg-headless`
  pluginnel és a `wordpress/seed` adataival.
- A Woo-nak MySQL (lokálisan MariaDB), tartós `wp-content/uploads` és háttérfeldolgozás (WP-Cron, Action
  Scheduler) kell. A frontend-platformok (Vercel, Cloudflare Workers/Pages/Containers) egyiket sem adják
  tartósan, ezért a backend nem futhat a frontenddel egy helyen.
- A BFF-döntés (ADR-0001) miatt a böngésző nem hívja közvetlenül a WP-t, csak a Next szervere. A WP-admint
  és a REST-végpontokat ezért nem kell a nyílt internetnek kiszolgálni.

## Döntés

- A brandenkénti WP + Woo példányok saját VPS-en, Docker Compose-zal futnak; a lokális compose éles
  változata a kiindulópont.
- A VPS előtt Cloudflare áll: DNS, TLS, WAF és bot-védelem, a VPS felé Cloudflare Tunnel (nincs nyitott
  bejövő port). A backend brandenként a saját domain aldomainjén érhető el (pl. `api.<brand-domain>`).
- A frontend hostingja ettől független; a tervezett cserét az ADR-0009 írja le.

## Következmények

- Több brand olcsón elfér egy gépen; a lokális és az éles környezet ugyanabból a compose-ból indul.
- Az üzemeltetés a miénk. Az élesítés előtt külön ticket(ek) kellenek:
  - éles compose: titkok env-fájlból vagy secret store-ból (a lokális alapértelmezett jelszavak nem mehetnek
    ki), `wpcli-*` konténer nélkül, a `kg-headless` plugin és a `wp-content` image-be építve vagy deployjal;
  - Cloudflare Tunnel és DNS, WAF-szabályok (`wp-login.php`, `xmlrpc.php` lezárva);
  - napi DB- és `uploads`-mentés visszaállítási próbával, WP/Woo/plugin frissítési runbook, monitorozás.
- A VPS-szolgáltató kiválasztása és a demo/staging Woo kérdése (`kg-stack`) nyitott marad.
- Frissítve: `kg-stack` („WordPress hosting” és „Edge, DNS, WAF” sor), `AGENTS.md` „Stack röviden”,
  `docs/project-plan.md` (hosting-összefoglaló, kockázatok, nyitott döntések), a hosting-döntésre utaló sor
  a `kg-architecture/references/multi-brand.md`-ben és a `kg-release`-ben.

## Mérlegelt alternatívák

| Alternatíva | Miért nem |
| ----------- | --------- |
| Menedzselt WP hosting brandenként | Brandenként külön díj; a lokális Docker-környezettől eltér, a saját plugin és a seed nehezebben vihető át |
| VPS + Docker Cloudflare nélkül (saját Caddy/TLS) | Nincs WAF és bot-védelem, nyitott portok kellenek; a Cloudflare-t a DNS és a képek (R2) miatt egyébként is használnánk |
| WP a Vercelen vagy a Cloudflare-en | Nincs tartós fájlrendszer és MySQL, a Containers elalszik; checkoutot és webhookot kiszolgáló Woo-nak törékeny |
