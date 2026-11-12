# packages/brand-config

Brandenként egy típusos, Zod-dal validált config (`src/brands/<id>.ts`), a `src/index.ts`-ben regisztrálva.
Mezők: `id`, `name`, `domains`, `woo.baseUrlEnv` (csak az env-változó neve), `locale`, `currency`,
`theme` (szín-, radius-, árnyék- és font-tokenek), `texts`, `payments`, `search`. Titok nem kerül ide.

- `resolveBrandByHost(host)`: a `proxy.ts` ezzel választ brandet; ismeretlen hostra `undefined` (fail-closed).
- `themeToCssVars(theme)`: a tokenekből CSS-változók; az `apps/web` a brand-layoutban teszi a lapra, a
  Tailwind `@theme` ezekre hivatkozik.
- A fontot az app tölti be (`next/font`), a brand csak a kulcsot választja (`fontKeys`).

Mezők és új brand checklistje: `.agents/skills/kg-architecture/references/multi-brand.md`.
