export type WooErrorCode = "WOO.UNAVAILABLE" | "WOO.CONTRACT_MISMATCH";

/** A Woo-hívások egyetlen hibatípusa; a `code` stabil szerződés (`DOMAIN.REASON`). */
export class WooError extends Error {
  readonly code: WooErrorCode;
  readonly status: number | undefined;

  constructor(code: WooErrorCode, message: string, options?: { status?: number; cause?: unknown }) {
    super(message, { cause: options?.cause });
    this.name = "WooError";
    this.code = code;
    this.status = options?.status;
  }
}

export function isWooError(error: unknown): error is WooError {
  return error instanceof WooError;
}
