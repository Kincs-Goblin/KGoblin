import { errorCatalog, type ErrorCode } from "./catalog";

export type AppErrorOptions = {
  cause?: unknown;
  internalReason?: string;
};

/**
 * Közös alkalmazásszintű hibatípus (`DOMAIN.REASON`).
 * A `message` mindig a katalógusból származó biztonságos felhasználói üzenet,
 * a belső ok (`internalReason`, `cause`) csak szerveroldali naplózásra szolgál.
 */
export class AppError extends Error {
  readonly code: ErrorCode;
  readonly status: number;
  readonly retryable: boolean;
  readonly userMessage: string;
  readonly internalReason: string | undefined;

  constructor(code: ErrorCode, options?: AppErrorOptions) {
    const entry = errorCatalog[code];
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
