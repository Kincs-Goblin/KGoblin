import type { CartDto } from "@/shared/api";

export const MAX_QUANTITY_PER_LINE = 30;

/**
 * Optimista darabszám-frissítés: kizárólag a sor darabszámát és az összdarabszámot módosítja,
 * pénzösszegeket soha nem számol (azok kizárólag a Woo válaszából jönnek).
 */
export function applyOptimisticQuantity(cart: CartDto, key: string, quantity: number): CartDto {
  const clamped = Math.min(MAX_QUANTITY_PER_LINE, Math.max(0, Math.trunc(quantity)));
  const items =
    clamped === 0
      ? cart.items.filter((item) => item.key !== key)
      : cart.items.map((item) => (item.key === key ? { ...item, quantity: clamped } : item));
  const itemsCount = items.reduce((sum, item) => sum + item.quantity, 0);
  return { ...cart, items, itemsCount };
}

export function applyOptimisticRemove(cart: CartDto, key: string): CartDto {
  return applyOptimisticQuantity(cart, key, 0);
}
