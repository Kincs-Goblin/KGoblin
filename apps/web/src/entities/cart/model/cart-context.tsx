"use client";

import { createContext, useContext, useEffect, useMemo, useReducer } from "react";
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
 * A `hydrated` jelző a kosárral egy állapotban van: a mentés csak a visszatöltött kosárral renderelt
 * körben indul, így a StrictMode dupla effect-futása sem írja felül a tárolt kosarat az üres
 * kezdőállapottal.
 */
type ProviderState = { cart: CartState; hydrated: boolean };

function providerReducer(state: ProviderState, action: CartAction): ProviderState {
  if (action.type === "hydrate") return { cart: action.state, hydrated: true };
  return { ...state, cart: cartReducer(state.cart, action) };
}

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
  const [{ cart: state, hydrated }, dispatch] = useReducer(providerReducer, {
    cart: { lines: [] },
    hydrated: false,
  });

  useEffect(() => {
    let stored: CartState = { lines: [] };
    try {
      const parsed = storedCartSchema.safeParse(
        JSON.parse(localStorage.getItem(storageKey) ?? "null"),
      );
      if (parsed.success) stored = parsed.data;
    } catch {
      // Tiltott vagy sérült tároló: üres kosárral megyünk tovább.
    }
    dispatch({ type: "hydrate", state: stored });
  }, [storageKey]);

  useEffect(() => {
    if (!hydrated) return;
    try {
      localStorage.setItem(storageKey, JSON.stringify(state));
    } catch {
      // A tároló nem kötelező; hibánál a kosár csak erre a lapra él.
    }
  }, [hydrated, state, storageKey]);

  const value = useMemo(() => ({ state, itemCount: countItems(state), dispatch }), [state]);
  return <CartContext.Provider value={value}>{children}</CartContext.Provider>;
}

export function useCart(): CartContextValue {
  const context = useContext(CartContext);
  if (!context) throw new Error("useCart csak CartProvideren belül használható");
  return context;
}
