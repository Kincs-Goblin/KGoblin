"use client";

import { createContext, useContext, useEffect, useMemo, useReducer, useRef } from "react";
import { z } from "zod";

import { cartReducer, countItems, type CartAction, type CartState } from "./cart-reducer";

type CartContextValue = {
  state: CartState;
  itemCount: number;
  dispatch: (action: CartAction) => void;
};

const CartContext = createContext<CartContextValue | null>(null);

const storedCartSchema = z.object({
  lines: z.array(
    z.object({
      productId: z.number(),
      slug: z.string(),
      name: z.string(),
      unitPrice: z.object({ amount: z.string(), currency: z.string(), minorUnit: z.number() }),
      quantity: z.number().int().positive(),
    }),
  ),
});

/**
 * A kliensoldali kosár a böngészőben marad (brandenként külön kulccsal). Csak termékazonosító,
 * név, megjelenített ár és darabszám - token vagy személyes adat nem.
 */
export function CartProvider({
  brandId,
  children,
}: {
  brandId: string;
  children: React.ReactNode;
}) {
  const storageKey = `kg-cart:${brandId}`;
  const [state, dispatch] = useReducer(cartReducer, { lines: [] });
  const hydrated = useRef(false);

  useEffect(() => {
    try {
      const parsed = storedCartSchema.safeParse(
        JSON.parse(localStorage.getItem(storageKey) ?? "null"),
      );
      if (parsed.success) dispatch({ type: "hydrate", state: parsed.data });
    } catch {
      // Tiltott vagy sérült tároló: üres kosárral megyünk tovább.
    }
    hydrated.current = true;
  }, [storageKey]);

  useEffect(() => {
    if (!hydrated.current) return;
    try {
      localStorage.setItem(storageKey, JSON.stringify(state));
    } catch {
      // A tároló nem kötelező; hibánál a kosár csak erre a lapra él.
    }
  }, [state, storageKey]);

  const value = useMemo(() => ({ state, itemCount: countItems(state), dispatch }), [state]);
  return <CartContext.Provider value={value}>{children}</CartContext.Provider>;
}

export function useCart(): CartContextValue {
  const context = useContext(CartContext);
  if (!context) throw new Error("useCart csak CartProvideren belül használható");
  return context;
}
