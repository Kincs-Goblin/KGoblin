export type WooErrorCode =
  | "WOO.UNAVAILABLE"
  | "WOO.CONTRACT_MISMATCH"
  | "WOO.INVALID_RESPONSE"
  | "CART.OUT_OF_STOCK"
  | "CART.INVALID_QUANTITY"
  | "CART.COUPON_INVALID"
  | "CART.SHIPPING_UNAVAILABLE"
  | "CART.SESSION_INVALID"
  | "CHECKOUT.VALIDATION_FAILED"
  | "CHECKOUT.PAYMENT_DECLINED";

export type WooErrorContext = "catalog" | "cart" | "checkout" | "rest";

/**
 * A Woo-hívások egyetlen hibatípusa; a `code` stabil szerződés (`DOMAIN.REASON`).
 * A `message` kizárólag belső diagnosztikára szolgál, felhasználói felületen mindig a hibakatalógus szövege jelenjen meg.
 */
export class WooError extends Error {
  readonly code: WooErrorCode;
  readonly status: number | undefined;
  readonly wooCode: string | undefined;

  constructor(
    code: WooErrorCode,
    message: string,
    options?: { status?: number; wooCode?: string; cause?: unknown },
  ) {
    super(message, { cause: options?.cause });
    this.name = "WooError";
    this.code = code;
    this.status = options?.status;
    this.wooCode = options?.wooCode;
  }
}

export function isWooError(error: unknown): error is WooError {
  return error instanceof WooError;
}

/**
 * A WooCommerce API 4xx/5xx hibakódjait saját, stabil `DOMAIN.REASON` kódokra képezi le kontextus szerint.
 */
export function mapWooErrorCode(
  wooCode: string | undefined,
  status: number,
  context: WooErrorContext = "catalog",
): WooErrorCode {
  if (status >= 500) {
    return "WOO.UNAVAILABLE";
  }

  const normalized = wooCode?.toLowerCase() ?? "";

  // Csak a Woo saját token- és nonce-hibája jelent lejárt kosár-sessiont (érvénytelen Cart-Tokennél a
  // Store API a nonce-ellenőrzésen bukik el: `woocommerce_rest_missing_nonce` / `_invalid_nonce`).
  if (
    (context === "cart" || context === "checkout") &&
    (normalized.includes("cart_token") || normalized.includes("nonce"))
  ) {
    return "CART.SESSION_INVALID";
  }

  // Minden más 401/403 (pl. WAF-blokk vagy challenge a szerver-szerver hívásra) upstream hiba: a kosár
  // cookie-ja nem törlődhet miatta.
  if (
    (context === "cart" || context === "checkout" || context === "rest") &&
    (status === 401 || status === 403)
  ) {
    return "WOO.UNAVAILABLE";
  }

  if (!normalized) {
    return "WOO.INVALID_RESPONSE";
  }

  if (
    (context === "cart" || context === "checkout") &&
    (normalized.includes("stock") ||
      normalized.includes("not_purchasable") ||
      normalized === "woocommerce_rest_product_partially_out_of_stock")
  ) {
    return "CART.OUT_OF_STOCK";
  }
  if ((context === "cart" || context === "checkout") && normalized.includes("quantity")) {
    return "CART.INVALID_QUANTITY";
  }
  if ((context === "cart" || context === "checkout") && normalized.includes("coupon")) {
    return "CART.COUPON_INVALID";
  }
  if ((context === "cart" || context === "checkout") && normalized.includes("shipping")) {
    return "CART.SHIPPING_UNAVAILABLE";
  }
  if (context === "checkout" && normalized.startsWith("kg_")) {
    return "CHECKOUT.VALIDATION_FAILED";
  }
  if (
    context === "checkout" &&
    (normalized === "woocommerce_rest_checkout_process_payment_error" ||
      normalized.includes("payment_declined") ||
      normalized.includes("payment_failed") ||
      normalized.includes("payment_error"))
  ) {
    return "CHECKOUT.PAYMENT_DECLINED";
  }
  if (
    context === "checkout" &&
    (normalized.includes("checkout") ||
      normalized.includes("invalid_param") ||
      normalized.includes("missing_param"))
  ) {
    return "CHECKOUT.VALIDATION_FAILED";
  }

  return "WOO.INVALID_RESPONSE";
}
