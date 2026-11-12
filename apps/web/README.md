# apps/web - Next.js storefront

Állapot: csak mappastruktúra, a scaffold a 0. mérföldkő ticketje.

- Next.js App Router + TypeScript, Tailwind + shadcn/ui, Vercelen.
- **FSD 3. szint:** a rétegek a `src/` alatt, a Next-routing az `app/` alatt.
- Szabályok és kódhely: `.agents/skills/kg-architecture/` (főleg `references/placement.md`).

```
app/            Next App Router - csak routing (re-export a src/pages-ből, vékony route.ts)
pages/          szándékosan üres (lásd pages/README.md)
src/
  app/          FSD app-réteg: providerek, globális stílus, brand-téma, Sentry/PostHog init
  pages/        oldalak kompozíciója
  widgets/      nagy, több oldalon visszatérő blokkok
  features/     felhasználói műveletek
  entities/     üzleti entitások
  shared/       ui, lib, api, config
e2e/            Playwright (a scaffoldban jön létre)
```

Szeletet akkor hozz létre, amikor az első valódi kód megjelenik; az egyes rétegek README-je felsorolja a
tervezett szeleteket.
