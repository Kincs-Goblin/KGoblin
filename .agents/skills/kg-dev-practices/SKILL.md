---
name: kg-dev-practices
description: Bevált fejlesztési gyakorlatok a KGoblin stackhez (Next.js, WooCommerce, Trigger.dev, fizetési és számlázó integrációk) - hogyan dolgozz agenttel, frontend-struktúra és téma, env-kezelés, auth és biztonság, tesztelési Definition of Done, külső API-k, Windows-csapdák. Használd nagyobb feature tervezésekor, tesztelés és kész-jelentés előtt, biztonsági vagy auth-kérdésnél, új külső API bekötésénél, és ha Windowson furcsa hiba jön (ékezet, CRLF, TLS).
---

# kg-dev-practices

Valódi hibákból leszűrt gyakorlatok, erre a stackre szabva. Az architektúra-szabályok a `kg-architecture`-ben,
a git a `kg-git-workflow`-ban vannak; itt nincsenek megismételve.

## 1. Hogyan dolgozz agenttel

- **Előbb terv, aztán kód** nagyobb, több réteget (web + woo-client + jobs + WP plugin) érintő munkánál:
  1. az agent felderíti a kódot, és elmondja, mit talált - a „csak 3 dolog marad ki” mögött sokszor több van;
  2. a nyitott döntések opciós kérdésként jönnek (2-4 opció, a javasolt elöl);
  3. egy napnál nagyobb munkánál tervdokumentum vagy ADR: folyamatábra, döntések indokkal, rétegenkénti
     munkalista, peremesetek, és amit tudatosan kihagyunk;
  4. kód csak a döntések után. Kis, egyértelmű javításnál ez felesleges ceremónia.
- **Scope.** „Csak redesign” → a működés nem változik. Ami túlmegy a kérésen, azt külön jelezd.
- **Párhuzamosság.** Hosszú felderítést vagy független részfeladatokat subagent vihet, de csak kifejezett
  kérésre. Amíg dolgoznak, a session maradjon nyitva.
- **Commit és push az emberé.** Az agent előkészít, az ember nézi át a diffet. Élesítés pénteken délután nincs.
- **Őszinte jelentés.** A „kész” és a „kész, de böngészőben nem próbáltam” két külön dolog.

## 2. Frontend

- **Struktúra:** FSD (`kg-architecture`). Típusok a szelet `model/`-jében, Woo-hívás csak az `api/`
  szegmensen és a `packages/woo-client`-en át, üzleti logika a `model/`-ben vagy a szerveren, nem a JSX-ben.
  Szöveg nem a komponensben, hanem a szelet `config/texts.ts`-ében vagy a brand texts-ben.
- **Téma a skeletonnál:** design tokenek az első naptól (`multi-brand.md`). Utólag 40 fájlban hex színt
  cserélni sokkal drágább, mint egy tokent.
- **RSC alapból**, `"use client"` csak ott, ahol interakció kell; a client komponens ne importáljon
  `server-only` modult.
- **Gyakori UI-csapdák:**
  - listaelem `key`-e az `id`, nem a felirat (a terméknév nem egyedi);
  - ha egy komponens kétszer renderelődik (pl. a zárt cart-drawerben is), a tesztben a `getByText` kétszer
    talál; használj `getByRole`-t, vagy szűkíts;
  - `position: sticky` nem működik olyan ős alatt, amin `transform` van;
  - hydration mismatch: dátum, véletlen szám, `window` a szerveren renderelt részben.

## 3. Környezet és konfiguráció

- Next env-rangsor: `process.env` > `.env.<mode>.local` > `.env.local` (tesztben nem töltődik) >
  `.env.<mode>` > `.env`. A lokális felülbírálás a gitignore-olt `*.local` fájlba kerül.
- Az env-séma Zod-dal validált (`shared/config/env.ts`), külön server- és client-részre. Hiányzó kötelező
  változó → a build elbukik, nem futásidőben derül ki.
- Új env-kulcs: csak a kulcsnév a `.env.example`-be, plusz a beállítás helye (Vercel, Trigger.dev) a PR
  „Figyelni” részébe. Érték soha nem kerül a repóba.
- A csak nálad működő módosítás (lokális proxy, debug flag a `next.config`-ban) soha nem kerül commitba.

## 4. Auth és biztonság

| Mit | Ajánlott | Kerülendő |
|---|---|---|
| Vásárlói token, kosártoken | httpOnly + Secure + SameSite cookie, brandenként | `localStorage`, `sessionStorage` |
| Woo consumer key/secret, webhook-titok | Vercel / Trigger.dev env, `server-only` modul | `NEXT_PUBLIC_*`, kód, commitolt config |
| Fizetési titkok | csak a WordPress gateway pluginjében | a Next.js-ben bárhol |

- **Frontendbe nem kerül titok.** Ami a kliens bundle-ben van, az nyilvános.
- **Webhook:** aláírás-ellenőrzés a nyers bodyn, időzítésbiztos összehasonlítással; érvénytelennél 401.
- **Token, jelszó, kártyaadat, teljes cím soha nem kerül logba** vagy Sentrybe (Sentry `beforeSend` szűrés).
- **Rate limit** a login, regisztráció, kupon és checkout server actionökön.
- **Admin felület:** a WP-admin külön aldomainen, erős jelszóval, 2FA-val; a REST v3 kulcsok minimális joggal.
- Teszt miatti ideiglenes lazítás (pl. kikapcsolt aláírás-ellenőrzés DEV-en) külön commitban, és vissza is vonod.

## 5. Tesztelés - Definition of Done

Egy feladat akkor kész, ha:

1. **Unit- és integrációs tesztek** zöldek (Vitest). Új üzleti szabályhoz új teszt; a teszt az invariánst
   rögzíti, nem az implementációt. Woo-válaszokat MSW mockol, valódi (anonimizált) fixture-ökből.
2. **Typecheck, lint, Steiger és build** zöld.
3. **End-to-end:** Playwright a fő vásárlói útra, vagy kézi végigkattintás böngészőben, minden érintett
   brandre. Mockolt bejelentkezésnél a token-frissítő hívást is mockold sikeresre, különben a session
   véletlenszerűen kilép.
4. **Valódi próba a lokális stacken**, ha Woo, webhook vagy job érintett: valódi rendelés a Docker-Woo-n,
   és nézd meg, mi keletkezett (rendelés, megjegyzés, email, fake beszállítói hívás). Ami nincs kipróbálva,
   azt rögzítsd a PR-ban. Lépésről lépésre: `references/local-stack.md` (Docker-Woo indítása, KG-4 tesztek,
   storefront a Woo-val, ellenőrző táblázat, leállítás).
5. **CI zöld** (GitHub Actions, ADR-0005): a quality gate és a Playwright e2e a PR-on. A CI nem indít Woo-t,
   ezért a 4. pont helyben marad.

A skipelt teszt nem sikeres teszt.

## 6. Külső API-k és integrációk

- **Keresd meg a gépi sémát** (OpenAPI, `llms.txt`, Postman collection). Egy letölthető séma sok kérdést lezár.
- **A séma nem a viselkedés.** Hibakódokra, idempotenciára, limitekre a dokumentáció és a próbahívás a forrás.
- **Sandbox először:** Stripe test mode, Barion és SimplePay teszt-környezet, Billingo sandbox, beszállítói
  teszt-API, ha van. Éles kulccsal fejlesztés közben nem hívunk.
- **A furcsaságokat írd le** (pl. „a mezőt JSON-stringként várja, és üres 500-at ad”): a
  `packages/woo-client/README.md` vagy az adapter README „Ismert furcsaságok” részébe.
- **Tisztázd, mi kié.** Beszállító, gateway vagy Billingo szerverén nem fejlesztünk; ha egy megoldás az ő
  oldalukon igényelne változást, az nem járható út.

## 7. Windows-csapdák

- **PowerShell 5.1 + ékezetes fájl:** a `Get-Content | Set-Content` BOM nélküli UTF-8-at ANSI kódlappal
  olvas, így az ékezetekből mojibake lesz. Szövegcserére az agent Edit/Write eszközét használd.
- **CRLF:** a `sed -i` és a `\n`-nel író szkriptek vegyes sorvéget hagynak. Figyeld a git
  „LF will be replaced by CRLF” figyelmeztetését (`.gitattributes` a scaffoldban).
- **curl TLS-hiba (schannel revocation):** `Invoke-WebRequest -UseBasicParsing` működik helyette.
- **8.3-as rövid útvonal** (`C:\Users\NEVE~1`): teljes útvonalat használj.
- **Docker Desktop + WSL2:** a bind-mountolt WordPress lassú lehet; a `wp-content` legyen a mount, a core ne.
  Ha a motor nem indul (a `docker-desktop` disztró `Stopped`): jóváhagyással `wsl --shutdown`, majd a Docker
  Desktop újraindítása (`references/local-stack.md`).
- **Node-verzió:** 22.12 alatt a Tailwind 4 build `require() of ES Module` hibával elbukik; a `.nvmrc` (26)
  a mérvadó.
- **Beragadt szerver a porton:** a háttérben indított `next start` leállítása után a Node-gyerekfolyamat
  futva maradhat, és a régi buildet szolgálja ki (CSS 500). Port felszabadítása előtt nézd meg a
  folyamat parancssorát.
- **Playwright Windowson:** a headless Chromium párhuzamosan instabil volt (navigációs timeout), ezért a
  konfig `workers: 1`. Agent-sandboxban a Chromium nem indul (0xC0000142); sandbox nélkül fut.
