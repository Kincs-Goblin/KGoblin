import { errorCatalog, type ErrorCode } from "@/shared/lib/errors";

import type { CartDto } from "../model/types";

export type CartApiResponse =
  { ok: true; cart: CartDto } | { ok: false; code: ErrorCode; message: string; cart?: CartDto };

export type AddCartItemPayload = {
  id: number;
  quantity?: number;
  variation?: Array<{ attribute: string; value: string }>;
};

export type UpdateShippingAddressPayload = {
  country?: string;
  postcode: string;
  city?: string;
};

async function requestCartApi(url: string, init?: RequestInit): Promise<CartApiResponse> {
  try {
    const response = await fetch(url, {
      credentials: "same-origin",
      cache: "no-store",
      ...init,
      headers: {
        Accept: "application/json",
        ...(init?.body ? { "Content-Type": "application/json" } : {}),
        ...init?.headers,
      },
    });
    const json = (await response.json()) as CartApiResponse;
    if (typeof json === "object" && json !== null && "ok" in json) {
      return json;
    }
    return {
      ok: false,
      code: "WOO.INVALID_RESPONSE",
      message: "Érvénytelen válasz érkezett a szervertől.",
    };
  } catch {
    return {
      ok: false,
      code: "WOO.UNAVAILABLE",
      message: errorCatalog["WOO.UNAVAILABLE"].message,
    };
  }
}

export function fetchCart(): Promise<CartApiResponse> {
  return requestCartApi("/api/cart", { method: "GET" });
}

export function apiAddCartItem(payload: AddCartItemPayload): Promise<CartApiResponse> {
  return requestCartApi("/api/cart/items", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export function apiUpdateCartItem(key: string, quantity: number): Promise<CartApiResponse> {
  return requestCartApi("/api/cart/items", {
    method: "PATCH",
    body: JSON.stringify({ key, quantity }),
  });
}

export function apiRemoveCartItem(key: string): Promise<CartApiResponse> {
  return requestCartApi("/api/cart/items", {
    method: "DELETE",
    body: JSON.stringify({ key }),
  });
}

export function apiClearCart(): Promise<CartApiResponse> {
  return requestCartApi("/api/cart", { method: "DELETE" });
}

export function apiApplyCoupon(code: string): Promise<CartApiResponse> {
  return requestCartApi("/api/cart/coupons", {
    method: "POST",
    body: JSON.stringify({ code }),
  });
}

export function apiRemoveCoupon(code: string): Promise<CartApiResponse> {
  return requestCartApi("/api/cart/coupons", {
    method: "DELETE",
    body: JSON.stringify({ code }),
  });
}

export function apiSelectShippingRate(rateId: string, packageId = 0): Promise<CartApiResponse> {
  return requestCartApi("/api/cart/shipping", {
    method: "POST",
    body: JSON.stringify({ packageId, rateId }),
  });
}

export function apiUpdateShippingAddress(
  payload: UpdateShippingAddressPayload,
): Promise<CartApiResponse> {
  return requestCartApi("/api/cart/shipping", {
    method: "PATCH",
    body: JSON.stringify(payload),
  });
}
