# packages/config

Közös fejlesztői presetek:

- `tsconfig/base.json`: strict, `noUncheckedIndexedAccess`, `verbatimModuleSyntax`;
- `tsconfig/nextjs.json`: a Next appnak (DOM, JSX);
- `tsconfig/library.json`: a `packages/*` csomagoknak;
- `eslint/base`: ESLint flat config (typescript-eslint, Prettier-kompatibilis).

A Prettier-konfig a repó gyökerében van (`.prettierrc.json`), a Steiger-konfig az `apps/web`-ben.
