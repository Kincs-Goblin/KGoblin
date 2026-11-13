/**
 * Hibakód-katalógus (`DOMAIN.REASON`). A kód stabil szerződés, a szöveg változhat.
 * Új kód csak ide (és a jobs megfelelő katalógusába) kerülhet.
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
  "WOO.INVALID_RESPONSE": {
    status: 502,
    retryable: true,
    message: "Érvénytelen válasz érkezett a kincstárból. Már dolgozunk rajta.",
  },
  "CART.OUT_OF_STOCK": {
    status: 409,
    retryable: false,
    message: "A választott zsákmány időközben elfogyott.",
  },
  "CART.INVALID_QUANTITY": {
    status: 400,
    retryable: false,
    message: "A megadott mennyiség nem érvényes.",
  },
  "CART.COUPON_INVALID": {
    status: 409,
    retryable: false,
    message: "A megadott kuponkód nem érvényes vagy már lejárt.",
  },
  "CHECKOUT.VALIDATION_FAILED": {
    status: 400,
    retryable: false,
    message: "Kérjük, ellenőrizd a megadott számlázási és szállítási adatokat.",
  },
  "CHECKOUT.PAYMENT_DECLINED": {
    status: 402,
    retryable: true,
    message: "A fizetés nem sikerült. Próbáld újra vagy válassz másik fizetési módot.",
  },
  "APP.UNEXPECTED": {
    status: 500,
    retryable: true,
    message: "Váratlan hiba történt. Próbáld újra egy kicsit később.",
  },
} as const satisfies Record<string, { status: number; retryable: boolean; message: string }>;

export type ErrorCode = keyof typeof errorCatalog;
