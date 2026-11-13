/**
 * Háttérjobok hibakód-katalógusa (`DOMAIN.REASON`).
 * A kód stabil szerződés, a szöveg változhat.
 */
export const jobErrorCatalog = {
  "BRAND.UNKNOWN_ID": {
    status: 400,
    retryable: false,
    message: "Ismeretlen brand-azonosító a háttérjobban.",
  },
  "WOO.UNAVAILABLE": {
    status: 503,
    retryable: true,
    message: "A WooCommerce példány átmenetileg nem érhető el.",
  },
  "WOO.INVALID_RESPONSE": {
    status: 502,
    retryable: true,
    message: "Érvénytelen válasz érkezett a WooCommerce REST API-tól.",
  },
  "SUPPLIER.FEED_INVALID": {
    status: 422,
    retryable: false,
    message: "A beszállítói termékfeed nem felel meg a várt sémának.",
  },
  "SUPPLIER.ORDER_FORWARD_UNCERTAIN": {
    status: 504,
    retryable: false,
    message: "A beszállítói rendelés-továbbítás válasza bizonytalan; kézi ellenőrzés szükséges.",
  },
  "JOB.INVALID_PAYLOAD": {
    status: 400,
    retryable: false,
    message: "A háttérjob bemeneti paraméterei érvénytelenek.",
  },
  "JOB.CONFIG_MISSING": {
    status: 500,
    retryable: false,
    message: "Hiányzó vagy érvénytelen környezeti konfiguráció a háttérjobban.",
  },
  "APP.UNEXPECTED": {
    status: 500,
    retryable: true,
    message: "Váratlan hiba történt a háttérjob futása közben.",
  },
} as const satisfies Record<string, { status: number; retryable: boolean; message: string }>;

export type JobErrorCode = keyof typeof jobErrorCatalog;

export type AppErrorOptions = {
  cause?: unknown;
  internalReason?: string;
};

/**
 * Közös hibatípus a háttérjobokhoz (`DOMAIN.REASON`).
 * A `retryable` jelző alapján a Trigger.dev task eldöntheti, szabad-e automatikusan újrapróbálni.
 */
export class AppError extends Error {
  readonly code: JobErrorCode;
  readonly status: number;
  readonly retryable: boolean;
  readonly userMessage: string;
  readonly internalReason: string | undefined;

  constructor(code: JobErrorCode, options?: AppErrorOptions) {
    const entry = jobErrorCatalog[code];
    super(entry.message, { cause: options?.cause });
    this.name = "AppError";
    this.code = code;
    this.status = entry.status;
    this.retryable = entry.retryable;
    this.userMessage = entry.message;
    this.internalReason = options?.internalReason;
  }
}

export function isAppError(error: unknown): error is AppError {
  return error instanceof AppError;
}
