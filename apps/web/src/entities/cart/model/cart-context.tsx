"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { toast } from "sonner";

import { EMPTY_CART_DTO, type CartDto } from "@/shared/api";
import type { ErrorCode } from "@/shared/lib/errors";

import {
  apiAddCartItem,
  apiApplyCoupon,
  apiClearCart,
  apiRemoveCartItem,
  apiRemoveCoupon,
  apiSelectShippingRate,
  apiUpdateCartItem,
  apiUpdateShippingAddress,
  fetchCart,
  type AddCartItemPayload,
  type CartApiResponse,
  type UpdateShippingAddressPayload,
} from "../api/cart-client";
import { applyOptimisticQuantity, applyOptimisticRemove } from "./cart-optimistic";

export type CartMutationResult =
  { ok: true; cart: CartDto } | { ok: false; code: ErrorCode; message: string };

type CartContextValue = {
  cart: CartDto;
  itemCount: number;
  loading: boolean;
  mutating: boolean;
  pendingKeys: ReadonlySet<string>;
  refreshCart: () => Promise<void>;
  addItem: (payload: AddCartItemPayload) => Promise<CartMutationResult>;
  updateItemQuantity: (key: string, quantity: number) => Promise<CartMutationResult>;
  removeItem: (key: string) => Promise<CartMutationResult>;
  clearCart: () => Promise<CartMutationResult>;
  applyCoupon: (code: string) => Promise<CartMutationResult>;
  removeCoupon: (code: string) => Promise<CartMutationResult>;
  selectShippingRate: (rateId: string, packageId?: number) => Promise<CartMutationResult>;
  updateShippingAddress: (payload: UpdateShippingAddressPayload) => Promise<CartMutationResult>;
};

const CartContext = createContext<CartContextValue | null>(null);

/**
 * Kosár-kontextus a Next BFF (`/api/cart*`) fölött. A `Cart-Token` kizárólag szerveroldali
 * `httpOnly` cookie-ban él; a kliens nem tárol tokent és nem számol pénzösszeget.
 */
export function CartProvider({
  brandId,
  children,
}: {
  brandId: string;
  children: React.ReactNode;
}) {
  const [cart, setCart] = useState<CartDto>(EMPTY_CART_DTO);
  const [loading, setLoading] = useState(true);
  const [mutatingCount, setMutatingCount] = useState(0);
  const [pendingKeys, setPendingKeys] = useState<ReadonlySet<string>>(() => new Set());
  const cartRef = useRef<CartDto>(EMPTY_CART_DTO);
  const mutationEpochRef = useRef(0);
  const mutationQueueRef = useRef<Promise<unknown>>(Promise.resolve());

  const commitCart = useCallback((next: CartDto) => {
    cartRef.current = next;
    setCart(next);
  }, []);

  const refreshCart = useCallback(async () => {
    const startEpoch = mutationEpochRef.current;
    setLoading(true);
    const result = await fetchCart();
    if (mutationEpochRef.current === startEpoch) {
      if (result.ok) {
        commitCart(result.cart);
      } else if (result.cart) {
        commitCart(result.cart);
      }
    }
    setLoading(false);
  }, [commitCart]);

  useEffect(() => {
    let cancelled = false;
    const startEpoch = mutationEpochRef.current;
    void fetchCart().then((result) => {
      if (cancelled) return;
      if (mutationEpochRef.current === startEpoch) {
        if (result.ok) {
          commitCart(result.cart);
        } else if (result.cart) {
          commitCart(result.cart);
        }
      }
      setLoading(false);
    });
    return () => {
      cancelled = true;
    };
  }, [brandId, commitCart]);

  const markPendingKey = useCallback((key: string, pending: boolean) => {
    setPendingKeys((prev) => {
      const next = new Set(prev);
      if (pending) next.add(key);
      else next.delete(key);
      return next;
    });
  }, []);

  const handleApiResult = useCallback(
    (
      result: CartApiResponse,
      options?: { rollbackTo?: CartDto; silentToast?: boolean },
    ): CartMutationResult => {
      if (result.ok) {
        commitCart(result.cart);
        return { ok: true, cart: result.cart };
      }
      if (result.cart) {
        commitCart(result.cart);
      } else if (options?.rollbackTo) {
        commitCart(options.rollbackTo);
      }
      if (!options?.silentToast) {
        toast.error(result.message);
      }
      return { ok: false, code: result.code, message: result.message };
    },
    [commitCart],
  );

  const runMutation = useCallback(
    (
      task: () => Promise<CartApiResponse>,
      options?: {
        pendingKey?: string;
        optimistic?: (current: CartDto) => CartDto;
        silentToast?: boolean;
      },
    ): Promise<CartMutationResult> => {
      mutationEpochRef.current += 1;
      if (options?.pendingKey) {
        markPendingKey(options.pendingKey, true);
      }
      setMutatingCount((c) => c + 1);

      // FIFO sorosítás: egyszerre csak egy kosármutáció fut a szerver felé, hogy a cookie és a
      // Nonce sorrendben frissüljön, és ne vesszen el párhuzamos „Kosárba” kattintás.
      const nextRun = mutationQueueRef.current
        .catch(() => undefined)
        .then(async (): Promise<CartMutationResult> => {
          const previous = cartRef.current;
          if (options?.optimistic) {
            commitCart(options.optimistic(previous));
          }
          try {
            const result = await task();
            return handleApiResult(result, {
              rollbackTo: options?.optimistic ? previous : undefined,
              silentToast: options?.silentToast,
            });
          } finally {
            setMutatingCount((c) => Math.max(0, c - 1));
            if (options?.pendingKey) {
              markPendingKey(options.pendingKey, false);
            }
          }
        });

      mutationQueueRef.current = nextRun;
      return nextRun;
    },
    [commitCart, handleApiResult, markPendingKey],
  );

  const addItem = useCallback(
    (payload: AddCartItemPayload) =>
      runMutation(() => apiAddCartItem(payload), { silentToast: true }),
    [runMutation],
  );

  const updateItemQuantity = useCallback(
    (key: string, quantity: number) =>
      runMutation(() => apiUpdateCartItem(key, quantity), {
        pendingKey: key,
        optimistic: (current) => applyOptimisticQuantity(current, key, quantity),
      }),
    [runMutation],
  );

  const removeItem = useCallback(
    (key: string) =>
      runMutation(() => apiRemoveCartItem(key), {
        pendingKey: key,
        optimistic: (current) => applyOptimisticRemove(current, key),
      }),
    [runMutation],
  );

  const clearCart = useCallback(() => runMutation(() => apiClearCart()), [runMutation]);

  const applyCoupon = useCallback(
    (code: string) => runMutation(() => apiApplyCoupon(code), { silentToast: true }),
    [runMutation],
  );

  const removeCoupon = useCallback(
    (code: string) => runMutation(() => apiRemoveCoupon(code)),
    [runMutation],
  );

  const selectShippingRate = useCallback(
    (rateId: string, packageId = 0) => runMutation(() => apiSelectShippingRate(rateId, packageId)),
    [runMutation],
  );

  const updateShippingAddress = useCallback(
    (payload: UpdateShippingAddressPayload) =>
      runMutation(() => apiUpdateShippingAddress(payload), { silentToast: true }),
    [runMutation],
  );

  const value = useMemo<CartContextValue>(
    () => ({
      cart,
      itemCount: cart.itemsCount,
      loading,
      mutating: mutatingCount > 0,
      pendingKeys,
      refreshCart,
      addItem,
      updateItemQuantity,
      removeItem,
      clearCart,
      applyCoupon,
      removeCoupon,
      selectShippingRate,
      updateShippingAddress,
    }),
    [
      cart,
      loading,
      mutatingCount,
      pendingKeys,
      refreshCart,
      addItem,
      updateItemQuantity,
      removeItem,
      clearCart,
      applyCoupon,
      removeCoupon,
      selectShippingRate,
      updateShippingAddress,
    ],
  );

  return <CartContext.Provider value={value}>{children}</CartContext.Provider>;
}

export function useCart(): CartContextValue {
  const context = useContext(CartContext);
  if (!context) throw new Error("useCart csak CartProvideren belül használható");
  return context;
}
