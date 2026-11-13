/**
 * Hibakód-katalógus (`DOMAIN.REASON`). A kód stabil szerződés, a szöveg változhat.
 * Új kód csak ide kerülhet.
 */
export const errorCatalog = {
  "BRAND.UNKNOWN_HOST": {
    status: 404,
    retryable: false,
    message: "Ez a cím nem tartozik egyik boltunkhoz sem.",
  },
  "WOO.UNAVAILABLE": {
    status: 503,
    retryable: true,
    message: "A kincstár most nem elérhető. Próbáld újra pár perc múlva.",
  },
  "WOO.CONTRACT_MISMATCH": {
    status: 502,
    retryable: true,
    message: "A termékadatok most nem tölthetők be. Már dolgozunk rajta.",
  },
  "APP.UNEXPECTED": {
    status: 500,
    retryable: true,
    message: "Váratlan hiba történt. Próbáld újra egy kicsit később.",
  },
} as const satisfies Record<string, { status: number; retryable: boolean; message: string }>;

export type ErrorCode = keyof typeof errorCatalog;
