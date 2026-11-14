# apps/web - Next.js storefront

Next.js (App Router) + TypeScript, Tailwind 4 + shadcn/ui (Base UI), Motion, FSD 3. szint, Cloudflare Workersen (OpenNext, ADR-0009).
Szabályok és kódhely: `.agents/skills/kg-architecture/` (főleg `references/placement.md`); döntések: ADR-0001,
ADR-0004.

```
app/            Next App Router - csak routing (re-export a src/-ből)
  [brand]/      a proxy.ts a domainből ide írja át a kérést (gamer.localhost → /gamer)
pages/          szándékosan üres (lásd pages/README.md)
proxy.ts        domain → brand rewrite; ismeretlen host: 404 BRAND.UNKNOWN_HOST
src/
  app/          FSD app-réteg: root- és brand-layout, providerek, globális stílus, brand-téma, fontok
  pages/        oldalak kompozíciója (home, not-found, error)
  widgets/      header, footer
  shared/       ui (shadcn + motion), lib (cn, hibakódok), config (brand, útvonalak)
e2e/            Playwright smoke (desktop + mobil, reduced motion)
```

## Futtatás

```bash
pnpm dev                        # http://gamer.localhost:3000
pnpm test                       # Vitest
pnpm test:e2e                   # Playwright; SCREENSHOTS=1 → output/ui-review/KG-5/
pnpm dlx shadcn@latest add <x>  # új shadcn komponens a src/shared/ui alá, utána tokenekre igazítva
```

## Téma

- A színek, a radius, az árnyékok és a fontkulcsok a `packages/brand-config`-ban vannak; a brand-layout
  `:root` CSS-változókként teszi ki őket, a Tailwind `@theme inline` ezekre hivatkozik
  (`src/app/styles/globals.css`). Komponensben nincs hex szín.
- Közös felület-osztályok: `frame-gold` (aranykeret), `surface-wood`, `surface-stone`, `text-engraved`.
- Ritkaság-badge: `<Badge variant="common | rare | epic | legendary">`.
- Animáció: `motion/react` a `src/shared/ui/motion` tokenjeivel; a `MotionProvider` a csökkentett mozgást
  tiszteletben tartja.
