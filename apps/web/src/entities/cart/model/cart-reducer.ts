import type { MoneyParts } from "@/shared/lib/format";

/**
 * Kliensoldali kosár (KG-5: a Store API kosár a 2. mérföldkőben jön). A sor a Woo által adott
 * egységárat csak megjelenítésre őrzi; összeget, kedvezményt vagy végösszeget itt nem számolunk.
 */
export type CartLine = {
  productId: number;
  slug: string;
  name: string;
  unitPrice: MoneyParts;
  quantity: number;
};

export type CartState = { lines: CartLine[] };

export type CartAction =
  | { type: "add"; line: Omit<CartLine, "quantity">; quantity?: number }
  | { type: "setQuantity"; productId: number; quantity: number }
  | { type: "remove"; productId: number }
  | { type: "clear" }
  | { type: "hydrate"; state: CartState };

/** Egy sor felső korlátja; a valódi készlet- és darabszám-ellenőrzés a Woo-kosárban lesz. */
export const MAX_QUANTITY_PER_LINE = 30;

const clamp = (quantity: number) =>
  Math.min(MAX_QUANTITY_PER_LINE, Math.max(0, Math.trunc(quantity)));

export function cartReducer(state: CartState, action: CartAction): CartState {
  switch (action.type) {
    case "add": {
      const amount = clamp(action.quantity ?? 1);
      if (amount === 0) return state;
      const existing = state.lines.find((line) => line.productId === action.line.productId);
      if (existing) {
        return {
          lines: state.lines.map((line) =>
            line.productId === action.line.productId
              ? { ...line, quantity: clamp(line.quantity + amount) }
              : line,
          ),
        };
      }
      return { lines: [...state.lines, { ...action.line, quantity: amount }] };
    }
    case "setQuantity": {
      const quantity = clamp(action.quantity);
      return {
        lines:
          quantity === 0
            ? state.lines.filter((line) => line.productId !== action.productId)
            : state.lines.map((line) =>
                line.productId === action.productId ? { ...line, quantity } : line,
              ),
      };
    }
    case "remove":
      return { lines: state.lines.filter((line) => line.productId !== action.productId) };
    case "clear":
      return { lines: [] };
    case "hydrate":
      return action.state;
  }
}

/** A kosár-ikon számlálója: darabszám, nem pénzösszeg. */
export function countItems(state: CartState): number {
  return state.lines.reduce((sum, line) => sum + line.quantity, 0);
}
