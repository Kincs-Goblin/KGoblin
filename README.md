# KGoblin – Multi-Brand Headless Webshop Platform

Headless, több brandet kiszolgáló dropshipping e-commerce platform. Egyetlen közös Next.js (App Router + FSD) kódbázis szolgálja ki a tematikus shopokat (elsőként a **gamer** brandet), míg a háttérben brandenként külön **WordPress + WooCommerce** (HPOS + Redis + Store API) és **Trigger.dev** háttérjobok futnak.

- **Agent szabályok és architektúra:** [`AGENTS.md`](./AGENTS.md)
- **Projektterv és mérföldkövek:** [`docs/project-plan.md`](./docs/project-plan.md)
- **Architekturális döntések (ADR):** [`docs/adr/`](./docs/adr/)
- **Első lépések (Onboarding):** [`docs/process/onboarding.md`](./docs/process/onboarding.md)

---

## 📁 Monorepo felépítés

| Útvonal | Leírás |
|---|---|
| `apps/web/` | Next.js App Router storefront (`app/` routing, `src/` FSD 3. szintű rétegek) |
| `apps/jobs/` | Trigger.dev háttérjobok (beszállítói feed-szinkron, rendelés-továbbítás, számlázás) |
| `packages/woo-client/` | WooCommerce Store API és REST v3 kliens, Zod-sémák, webhook HMAC-validáció |
| `packages/brand-config/` | Brand-konfigurációk (domainek, téma tokenek, végpontok, fizetési módok) |
| `packages/config/` | Közös TypeScript, ESLint és Prettier presetek |
| `wordpress/plugins/kg-headless/` | Saját headless WooCommerce bővítmény (Store API checkout validáció, EU Omnibus, redirect) |
| `wordpress/seed/` | Brandenként paraméterezhető, idempotens WP-CLI tesztadat-generáló (`seed-brand.php`) |
| `wordpress/docker/` | Keresztplatformos lokális telepítő (`setup.ps1`, `setup.sh`) és Store API tesztek |

---

## 🚀 Lokális Headless WooCommerce Backend indítása (1 parancs)

A lokális fejlesztői környezet Dockerrel indítja a MariaDB-t, a Redist és a brandenkénti WordPress + WooCommerce (HPOS) példányt, majd automatikusan telepíti a magyar nyelvet, a `woocommerce`, `redis-cache` és `kg-headless` bővítményeket, végül betölti a gamer tesztadatokat (kategóriák, 8 termék, akciós ártörténet, jogi oldalak).

### Windows (PowerShell)

```powershell
powershell -ExecutionPolicy Bypass -File .\wordpress\docker\setup.ps1
```

### Linux / macOS

```bash
chmod +x ./wordpress/docker/setup.sh
./wordpress/docker/setup.sh
```

*(Opcionális: másold le a `.env.example` fájlt `.env` néven, ha egyedi portokat vagy jelszavakat szeretnél beállítani.)*

### Elérhetőségek lokális indítás után (1. brand: `gamer`)

- **WP Admin:** `http://localhost:8080/wp-admin` (`admin` / `admin123`)
- **Store API (Termékek):** `http://localhost:8080/wp-json/wc/store/v1/products`
- **Store API (Kosár / Checkout):** `http://localhost:8080/wp-json/wc/store/v1/checkout`
- **Nem-admin frontend kérések (`http://localhost:8080/`):** automatikus `302` átirányítás a Next.js storefrontra (`http://localhost:3000`).

---

## 🧪 Tesztelés (Omnibus + Store API Checkout + HPOS)

A `kg-headless` plugin egyaránt tartalmazza az EU Omnibus 30 napos legalacsonyabb ár (float-mentes integer) számítását és a Store API `/checkout` magyar jogi validációját (céges adószám + ÁSZF és fizetési kötelezettség elfogadása).

A teljes automatizált tesztcsomag futtatása:

```powershell
powershell -ExecutionPolicy Bypass -File .\wordpress\docker\test-store-api.ps1
```

Csak az Omnibus és adószám PHP unit-tesztek futtatása:

```bash
docker compose exec -T wpcli-gamer php /var/www/seed/test-omnibus.php
```
