import { cn } from "@/shared/lib/utils";

import { productTexts } from "../config/texts";

type StockLabelProps = {
  inStock: boolean;
  lowStockRemaining: number | null;
  className?: string;
};

export function StockLabel({ inStock, lowStockRemaining, className }: StockLabelProps) {
  const text = !inStock
    ? productTexts.outOfStock
    : lowStockRemaining != null
      ? productTexts.lowStock(lowStockRemaining)
      : productTexts.inStock;
  return (
    <p
      className={cn(
        "flex items-center gap-1.5 text-xs",
        inStock ? "text-foreground/80" : "text-destructive",
        className,
      )}
    >
      <span
        aria-hidden="true"
        className={cn("size-2 rounded-full", inStock ? "bg-mana" : "bg-destructive")}
      />
      {text}
    </p>
  );
}
