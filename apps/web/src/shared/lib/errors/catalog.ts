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
  "BRAND.UNKNOWN_ID": {
    status: 404,
    retryable: false,
    message: "Ismeretlen brand-azonosító.",
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
  "CART.SESSION_INVALID": {
    status: 401,
    retryable: false,
    message: "A kosár munkamenete lejárt. Frissítsd az oldalt és próbáld újra.",
  },
  "CHECKOUT.VALIDATION_FAILED": {
    status: 400,
    retryable: false,
    message: "Kérjük, ellenőrizd a megadott számlázási és szállítási adatokat.",
  },
  "CHECKOUT.PAYMENT_DECLINED": {
    status: 402,
    retryable: false,
    message: "A fizetés nem sikerült. Próbáld újra vagy válassz másik fizetési módot.",
  },
  "WEBHOOK.INVALID_SIGNATURE": {
    status: 401,
    retryable: false,
    message: "Érvénytelen webhook aláírás.",
  },
  "WEBHOOK.INVALID_PAYLOAD": {
    status: 400,
    retryable: false,
    message: "Érvénytelen webhook payload.",
  },
  "WEBHOOK.UNSUPPORTED_TOPIC": {
    status: 400,
    retryable: false,
    message: "Nem támogatott webhook topic.",
  },
  "WEBHOOK.PAYLOAD_TOO_LARGE": {
    status: 413,
    retryable: false,
    message: "Túl nagy webhook kérés.",
  },
  "WEBHOOK.CONFIG_ERROR": {
    status: 500,
    retryable: false,
    message: "Webhook konfigurációs hiba.",
  },
  "SEARCH.UNAVAILABLE": {
    status: 503,
    retryable: true,
    message: "A keresés átmenetileg nem érhető el. Próbáld újra pár perc múlva.",
  },
  "SEARCH.INVALID_RESPONSE": {
    status: 502,
    retryable: true,
    message: "A keresési találatok most nem tölthetők be. Már dolgozunk rajta.",
  },
  "SEARCH.CONFIG_MISSING": {
    status: 500,
    retryable: false,
    message: "A kereső szolgáltatás jelenleg nincs konfigurálva.",
  },
  "APP.UNEXPECTED": {
    status: 500,
    retryable: true,
    message: "Váratlan hiba történt. Próbáld újra egy kicsit később.",
  },
} as const satisfies Record<string, { status: number; retryable: boolean; message: string }>;

export type ErrorCode = keyof typeof errorCatalog;
