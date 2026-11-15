# ADR-0013: Kép-CDN és médiatár - Woo médiatár + Cloudflare CDN és Images binding

- Állapot: elfogadott
- Dátum: 2026-11-15
- Döntéshozók: SMark2256, ricsmond12
- Ticket: KG-34

## Kontextus

- A `kg-stack` „Képek” sora részben nyitott volt: az ADR-0009 már elfogadta a Cloudflare Images `IMAGES` bindingját a `next/image` képtranszformációhoz (átméretezés, WebP/AVIF; havi 5 000 egyedi transzformációig ingyenes, felette $0,50 / 1 000; nincs Vercel image-optimization kvóta).
- Nyitott maradt viszont, hol tároljuk az eredeti termékképeket és milyen CDN szolgálja ki azokat a `KG-9` (katalógus) és `KG-14` (beszállítói feed-szinkron) megvalósítása előtt.

## Döntés

- Az eredeti termékképek a WooCommerce médiatárában (`wp-content/uploads`, a backend VPS-en az `api.<brand-domain>` alatt) maradnak, Cloudflare CDN cache mögött.
- A frontend `next/image` komponensei a Cloudflare Workers `IMAGES` bindingon keresztül kérik le, optimalizálják és cache-elik a képeket a Cloudflare edge-en.
- Ha a médiatár mérete vagy a VPS lemez-/I/O-terhelése később indokolja, az eredeti fájlok egy WordPress R2/S3 offload réteggel átköltöztethetők Cloudflare R2-be anélkül, hogy a frontend vagy a Store API szerződés változna.

## Következmények

- **Előnyök:** $0/hó extra tárhely- vagy SaaS-díj az indulásnál; nincs szükség WP offload pluginra vagy job-szintű külső objektumfeltöltésre az M1-ben; a Woo Store API, a REST v3, a WP Admin és a lokális Docker-Woo változatlanul működik.
- **Korlátok és későbbi feladatok (`KG-9`, `KG-14`, `KG-20`):**
  - a termékképek a VPS lemezén és annak napi mentésében foglalnak helyet, ezért a VPS lemezméretét a beszállítói katalógus képmennyiségéhez kell igazítani;
  - a Woo `uploads` statikus fájljaira hosszú `Cache-Control` fejlécet kell beállítani, hogy a Cloudflare edge cache maximalizálja a találati arányt és minimális origin-kérés menjen át a Cloudflare Tunnelön;
  - a `KG-9`-ben a `next/image` konfigurációban engedélyezni kell a brandek Woo-domainjeit (`remotePatterns` vagy loader).
- Frissítve: `kg-stack` („Képek” sor), `AGENTS.md` („Stack röviden”), `docs/project-plan.md` („Nyitott döntések”).

## Mérlegelt alternatívák

| Alternatíva | Miért nem |
| --- | --- |
| Cloudflare R2 az indulástól (`media.<brand>` + `IMAGES` binding) | 10 GB/hó tárhely és egress ingyenes, tehermentesíti a VPS lemezét, de már az 1. mérföldkő előtt WP R2-offload plugint vagy job-szintű feltöltést és lokális emulációt igényelne; növekedéskor később bármikor bevezethető |
| Cloudinary | Erős DAM, de az ingyenes keret felett $89/hó-tól indul, és az ADR-0009 `IMAGES` bindingja mellett feleslegesen duplikálná a képtranszformációt és külső vendor lock-int hozna |
