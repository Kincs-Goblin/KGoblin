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
  "APP.UNEXPECTED": {
    status: 500,
    retryable: true,
    message: "Váratlan hiba történt. Próbáld újra egy kicsit később.",
  },
} as const satisfies Record<string, { status: number; retryable: boolean; message: string }>;

export type ErrorCode = keyof typeof errorCatalog;
