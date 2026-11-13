# Lokális teljes stack: Docker-Woo + Next storefront

Mikor: ha a változás Woo-adatot, kosarat, checkoutot, webhookot vagy a brand-redirectet érinti, vagy ha
kérik, hogy „nézzük meg a Dockerrel is”. A CI nem indít Woo-t (ADR-0005); ez a valódi integrációs próba.

## 1. Előfeltételek

- Node a `.nvmrc` szerint (26). Ha a gép alapértelmezettje régebbi, az agent a parancsai elé teheti:
  `PATH="<nvm-mappa>/v26.x:$PATH"`; a felhasználó globális `nvm use`-át kérés nélkül ne állítsd át.
- Docker Desktop fut: `docker info --format '{{.ServerVersion}}'` verziót ad.
  - Ha a motor nem áll fel (500-as `_ping`, a `wsl -l -v` szerint a `docker-desktop` `Stopped`): kérdezz,
    majd Docker Desktop leállítása, `wsl --shutdown`, Docker Desktop újraindítása. A `wsl --shutdown` minden
    WSL-disztrót leállít, ezért csak jóváhagyással.
- A 8080-as és a 3000-es port szabad: `netstat -ano | grep -E ":(8080|3000) " | grep LISTEN`.

## 2. Woo-backend indítása

A `wordpress/docker/` a KG-4 óta a repóban van. Ha a KG-4 még nincs a célágban, a `feat/KG-4-…` ágat bontsd ki
egy külön mappába (`git archive origin/feat/KG-4-headless-wp-backend | tar -x -C <mappa>`), és ott futtasd;
a nem commitolt munkádat ne kapcsold át.

1. `.env` a `.env.example`-ből, a frontend-céllal a host-alapú brandhez:
   `WP_GAMER_FRONTEND_URL=http://gamer.localhost:3000` (a `localhost:3000` nálunk 404 `BRAND.UNKNOWN_HOST`).
2. Telepítés és seed: `powershell -ExecutionPolicy Bypass -File .\wordpress\docker\setup.ps1`
   (Linux/macOS: `./wordpress/docker/setup.sh`). Idempotens, újrafuttatható.
3. Backend-tesztek: `powershell -ExecutionPolicy Bypass -File .\wordpress\docker\test-store-api.ps1` -
   mind `[PASS]` legyen (Omnibus, adószám, redirect, Store API, kosár, checkout, HPOS-meta).

Elérhetőség: WP admin `http://localhost:8080/wp-admin`, Store API `http://localhost:8080/wp-json/wc/store/v1/`.

## 3. Storefront a Woo-val

1. `pnpm turbo run build --filter=@kg/web`, majd `pnpm --filter @kg/web start --port 3000`
   (fejlesztéshez `pnpm dev`). Amint a web Woo-adatot olvas (KG-5 2. PR), a
   `WOO_GAMER_URL=http://localhost:8080` az `apps/web/.env.local`-ba megy.
2. Ellenőrzés:

| Mit | Elvárt |
|---|---|
| `curl -s -o /dev/null -w "%{http_code} %{redirect_url}" http://localhost:8080/` | `302 http://gamer.localhost:3000/` |
| `http://gamer.localhost:3000/` böngészőben | 200, brand-téma, konzolhiba nélkül |
| `curl -s http://127.0.0.1:3000/` (ismeretlen host) | 404 `BRAND.UNKNOWN_HOST` |
| katalógus/termékoldal (ha a változás érinti) | a Store API termékei, Woo-ból jövő ár és Omnibus-ár |
| kosár/checkout (ha a változás érinti) | valódi rendelés a lokális Woo-n; nézd meg a WP adminban, mi keletkezett |

3. A PR „Ellenőrzés” részébe: mit futtattál ezek közül, és mi lett az eredmény.

## 4. Leállítás és csapdák

- Woo: a backend mappájából `docker compose down` (az adat a volume-okban marad; `down -v` törli).
- A háttérben indított `next start` leállítása után nézd meg, nem maradt-e Node-folyamat a porton
  (Windowson a gyerekfolyamat túlélheti a szülőt). Egy beragadt szerver a régi, törölt `.next` buildet
  szolgálja ki: a HTML 200, de a CSS 500 - a Playwright ezért mindig friss szervert indít.
- A seed-termékeknek nincs képe (`images: []`); a UI-nak kép nélkül is működnie kell.
