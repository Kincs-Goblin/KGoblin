# ADR-0004: Base UI a shadcn/ui alá, Motion az animációkhoz

- Állapot: elfogadott
- Dátum: 2026-11-12
- Döntéshozók: SMark2256, ricsmond12
- Ticket: KG-5

## Kontextus

- Az ADR-0001 a Tailwind + shadcn/ui párost fogadta el, de azt nem, hogy a shadcn melyik primitívkönyvtárra
  épüljön. A shadcn CLI ma három alapot kínál: Radix, Base UI és React Aria (`shadcn init --base`).
- A gamer brand (KG-5) Hearthstone-hangulatú, mozgalmas felületet kap: kártyaszerű termékkártyák, kosár-
  visszajelzés, csillogó kiemelések. Ehhez kell egy animációs könyvtár, eddig nem volt ilyen döntés.
- Az animáció nem ronthatja a hozzáférhetőséget (`prefers-reduced-motion`) és a teljesítményt (RSC-alapú
  oldalak, kis kliens-bundle).

## Döntés

1. **Base UI** (`@base-ui/react`) a shadcn/ui komponensek primitívkönyvtára. A `components.json` a
   `base-nova` stílust használja; a komponensek az `apps/web/src/shared/ui` alá kerülnek, a brand-tokenekre
   igazítva.
2. **Motion** (`motion`, `motion/react`, korábban Framer Motion) az egyetlen JS-animációs könyvtár.
   - Az időtartamok, easingek és rugók a `shared/ui/motion/tokens.ts`-ben vannak; komponensben nem írunk
     egyedi értéket.
   - A `MotionConfig reducedMotion="user"` az app-providerben van, így minden Motion-animáció tiszteletben
     tartja a csökkentett mozgást.
   - Csak `transform` és `opacity` animálódik; Motion csak kliens-komponensben fut, az oldalak RSC-k
     maradnak.
   - Az egyszerű hover- és fókuszállapot, valamint a shadcn primitívek saját be- és kiúszása CSS-ből megy
     (Tailwind transition, `tw-animate-css`); ez nem számít második animációs könyvtárnak.
   - Shadcn-kompatibilis Motion-registryből (pl. Animate UI, Motion Primitives) átvett komponens a repóba
     másolva kerül be, Base UI-jal kell működnie, és a licence a fájl fejkommentjében szerepel.
3. A fontokat a `next/font/google` build időben tölti le és saját domainről szolgálja ki (futásidőben nincs
   Google-hívás). Csak szabad licencű (SIL OFL) fontot használunk.

## Következmények

- A shadcn-dokumentáció Radix-példái nem mindig másolhatók egy az egyben: a Base UI API-ja eltér (pl.
  `render` prop az `asChild` helyett, `data-starting-style` / `data-ending-style` az átmenetekhez).
- A Base UI aktívan fejlődik; a minor-frissítéseknél a shadcn komponenseket újra kell generálni vagy
  kézzel igazítani (`shadcn add --overwrite`, utána tokenekre igazítás).
- A Motion a kliens-bundle-t növeli; ezért nem tesszük `"use client"`-be az egész oldalt, csak az animált
  levélkomponenst, és a bundle-méretet a PR-okban figyeljük.
- Frissítve: `kg-stack` (három új sor: UI-primitívek, Animáció, Fontok), `AGENTS.md` „Stack röviden”, `kg-architecture`
  (`references/placement.md`).

## Mérlegelt alternatívák

| Alternatíva | Miért nem |
| ----------- | --------- |
| Radix a shadcn alatt | Működne, de a csapat a Base UI-t kérte; a Base UI a Radix-szerzők újabb, aktívan fejlesztett könyvtára |
| React Aria a shadcn alatt | Erős a hozzáférhetőségben, de nagyobb API-felület, és a shadcn-ökoszisztémában kevesebb a példa |
| Csak CSS-animáció (Tailwind, `tw-animate-css`) | Rugós, megszakítható, layout- és jelenlét-animációkat (pl. kosár-számláló, drawer-lista) nehéz jól megírni |
| GSAP | Erős idővonalakhoz, de imperatív API, React-integrációja körülményesebb, és nem kell ilyen szintű idővonal |
| React Spring | Kisebb közösség és kevesebb shadcn-kompatibilis kész komponens, mint a Motionnél |
