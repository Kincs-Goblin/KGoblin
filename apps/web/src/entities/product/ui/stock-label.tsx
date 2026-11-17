import { cn } from "@/shared/lib/utils";

import { productTexts } from "../config/texts";
import { resolveStockStatus } from "../lib/map-product";
import type { StockStatus } from "../model/types";

type StockLabelProps = {
  stockStatus?: StockStatus;
  inStock: boolean;
  onBackorder?: boolean;
  lowStockRemaining: number | null;
  deliveryTime?: string | null;
  className?: string;
};

const dotTone: Record<StockStatus, string> = {
  in_stock: "bg-mana",
  low_stock: "bg-gold",
  backorder: "bg-rarity-rare",
  out_of_stock: "bg-destructive",
};

const textTone: Record<StockStatus, string> = {
  in_stock: "text-foreground/80",
  low_stock: "text-gold",
  backorder: "text-rarity-rare",
  out_of_stock: "text-destructive",
};

export function StockLabel({
  stockStatus,
  inStock,
  onBackorder = false,
  lowStockRemaining,
  deliveryTime,
  className,
}: StockLabelProps) {
  const status =
    stockStatus ??
    resolveStockStatus({
      inStock,
      onBackorder,
      lowStockRemaining,
    });

  const text =
    status === "out_of_stock"
      ? productTexts.outOfStock
      : status === "backorder"
        ? productTexts.onBackorder
        : status === "low_stock" && lowStockRemaining != null
          ? productTexts.lowStock(lowStockRemaining)
          : productTexts.inStock;

  return (
    <div className={cn("flex flex-col gap-0.5 text-xs", className)}>
      <p className={cn("flex items-center gap-1.5", textTone[status])}>
        <span aria-hidden="true" className={cn("size-2 shrink-0 rounded-full", dotTone[status])} />
        <span>{text}</span>
      </p>
      {deliveryTime && status !== "out_of_stock" ? (
        <p className="text-muted-foreground">
          {productTexts.deliveryLabel} {deliveryTime}
        </p>
      ) : null}
    </div>
  );
}
