# src/features - felhasználói műveletek

Egy szelet = egy művelet (ige-főnév): űrlap vagy gomb + mutáció. Szegmensek: `ui/`, `model/` (Zod-séma,
állapot), `api/` (server action, `"use server"`), `config/` (szövegek). Public API: `index.ts`.

Tervezett szeletek: `add-to-cart`, `update-cart-item`, `apply-coupon`, `filter-products`, `search-products`,
`select-shipping`, `select-payment`, `submit-checkout`, `auth-login`, `auth-register`, `auth-logout`.
