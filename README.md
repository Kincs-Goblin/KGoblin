# Saját Webshop – Lokális WordPress + WooCommerce Fejlesztői Környezet

Komplett, modern, magyar jogszabályoknak (ÁSZF, fizetési kötelezettség, céges adószám validáció, EU Omnibus 30 napos legalacsonyabb ár) és WooCommerce HPOS-nak megfelelő webáruház alaprendszer.

---

## 📁 Projekt felépítése

- `docker-compose.yml` – Lokális konténerizált környezet (PHP 8.3 + Apache, MariaDB 10.11, WP-CLI).
- `wordpress/wp-content/themes/custom-shop/` – Egyedi, reszponzív, **Tailwind CSS** alapú WooCommerce téma élő AJAX kosárral és ingyenes szállítási küszöb sávval.
- `wordpress/wp-content/plugins/hu-webshop-core/` – Saját magyar webshop üzleti és jogszabályi bővítmény (100% HPOS-kompatibilis).

---

## 🚀 Fejlesztői parancsok

### 0. Klónozás utáni első indítás (másik gépen)

Ha klónoztad a repót GitHubról, **csak a Docker Desktopnak kell futnia**, majd futtasd ezt az egyetlen parancsot a projekt mappájában (automatikusan letölti a WordPress-t, a WooCommerce-t, aktiválja a `custom-shop` témát és a `hu-webshop-core` bővítményt, valamint létrehozza az összes oldalt és tesztterméket):

```powershell
git clone https://github.com/Kincs-Goblin/KGoblin.git
cd KGoblin
powershell -ExecutionPolicy Bypass -File .\setup-webshop.ps1
```

Ezután a webshop azonnal megnyitható: **http://localhost:8080** (Admin: `http://localhost:8080/wp-admin` – `admin` / `admin123`).

### 1. Gyors automatikus telepítés (Docker + WP-CLI + Tesztadatok)

Ha a Docker Desktop fut, egyetlen paranccsal elindítható a teljes környezet és a WP-CLI konfiguráció:

```powershell
powershell -ExecutionPolicy Bypass -File .\setup-webshop.ps1
```

### 2. Docker környezet kézi kezelése

```bash
# Konténerek indítása a háttérben
docker compose up -d

# Konténerek állapota és logok
docker compose ps
docker compose logs -f wordpress

# Konténerek leállítása
docker compose down
```

- **Webshop elérése:** http://localhost:8080
- **WP Admin elérése:** http://localhost:8080/wp-admin
  - **Felhasználónév:** `admin`
  - **Jelszó:** `admin123`

### 2. WP-CLI parancsok futtatása

```bash
# Általános WP-CLI parancs futtatása a wpcli konténerben
docker compose exec wpcli wp <parancs>

# Példák:
docker compose exec wpcli wp plugin list
docker compose exec wpcli wp theme list
docker compose exec wpcli wp wc product list --user=admin
```

### 3. Tailwind CSS fordítása (`custom-shop` téma)

A téma mappájában (`./wordpress/wp-content/themes/custom-shop`):

```bash
cd wordpress/wp-content/themes/custom-shop

# Függőségek telepítése
npm install

# Egyszeri produkciós (minifikált) fordítás -> dist/output.css
npm run build

# Folyamatos figyelés fejlesztés közben (watch mód)
npm run watch
```

---

## 🇭🇺 Magyar webshop funkciók (`hu-webshop-core`)

1. **Magyarított pénztár mezők (`woocommerce_checkout_fields`):**
   - Magyar névsorrend: **Vezetéknév**, majd **Keresztnév**.
   - Felesleges mezők (Cím 2. sora, Megye/Állam) eltávolítva.
   - Opcionális **„Céges számlát kérek”** jelölőnégyzet, amely bepipáláskor megjeleníti a kötelező **Cégnév** és **Magyar adószám** (`12345678-2-42` formátum-ellenőrzéssel) mezőket.
2. **Kötelező jogi nyilatkozatok a pénztárban:**
   - Két nem előre bepipált, kötelező jelölőnégyzet a rendelés elküldése előtt:
     - *ÁSZF és Adatkezelési tájékoztató* elfogadása.
     - *Fizetési kötelezettség* tudomásulvétele (45/2014. (II. 26.) Korm. rendelet).
3. **Egyértelmű rendelés gomb:**
   - A pénztár gomb felirata: **„Megrendelés és fizetés”**.
4. **EU Omnibus irányelv – 30 napos legalacsonyabb ár:**
   - Árváltozáskor automatikusan naplózza az ártörténetet (`_hu_price_history`, `_hu_lowest_price_30_days`).
   - Akciós termékeknél a termékoldalon az akciós ár alatt megjeleníti: *„Az elmúlt 30 nap legalacsonyabb ára: X Ft”*.
5. **Teljes HPOS (High-Performance Order Storage) kompatibilitás:**
   - Minden rendelési metaadatot a `WC_Order` objektumon (`$order->update_meta_data()`, `wc_get_order()`) keresztül kezel.

---

## 🔌 Élesítés előtt telepítendő hivatalos bővítmények

Éles környezetbe állítás előtt az alábbi hivatalos integrációk telepítése és API kulcsokkal történő összekötése javasolt:

1. **Online bankkártyás fizetés:**
   - **Barion Payment Gateway for WooCommerce** (`pay-via-barion-for-woocommerce`) vagy **OTP SimplePay WooCommerce** – Bankkártyás, Apple Pay és Google Pay fizetéshez.
2. **Automatikus számlázás és NAV adatszolgáltatás:**
   - **Integration for Számlázz.hu & WooCommerce** (Viszt Péter / hivatalos Számlázz.hu bővítmény) vagy **Billingo Official WooCommerce** – Automatikus díjbekérő, előlegszámla és végszámla kiállítás (a `hu-webshop-core` által mentett `_billing_tax_number` adószám metaadattal kompatibilis).
3. **Csomagpontok és futárszolgálatok:**
   - **Foxpost WooCommerce** hivatalos csomagautomata-választó bővítmény.
   - **Packeta (Csomagküldő.hu)** hivatalos WooCommerce bővítmény (`packeta`).
   - **GLS / MPL (Magyar Posta) térképes csomagpont-választó** (kötelező MPL szállítási opció biztosításához a magyar postai kormányrendelet alapján).
4. **Marketing, Analitika és Cookie-kezelés (GDPR Consent Mode v2):**
   - **CookieYes** vagy **Complianz GDPR/CCPA Cookie Consent** (Google Consent Mode v2 támogatással).
   - **GTM4WP (Google Tag Manager for WordPress)** – Teljes e-commerce méréshez (GA4, Meta Pixel, Google Ads konverziók).
