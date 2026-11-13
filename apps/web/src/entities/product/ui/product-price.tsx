import { formatMoney } from "@/shared/lib/format";
import { cn } from "@/shared/lib/utils";

import { productTexts } from "../config/texts";
import type { ProductPrice as ProductPriceModel } from "../model/types";

type ProductPriceProps = {
  price: ProductPriceModel;
  size?: "sm" | "lg";
  className?: string;
};

/** Csak a Woo által adott árakat jeleníti meg; kedvezményt vagy különbözetet nem számol. */
export function ProductPrice({ price, size = "sm", className }: ProductPriceProps) {
  return (
    <div className={cn("flex flex-col gap-0.5", className)}>
      <div className="flex flex-wrap items-baseline gap-x-2">
        <span
          className={cn("font-heading font-bold text-gold", size === "lg" ? "text-3xl" : "text-lg")}
        >
          {formatMoney(price.current)}
        </span>
        {price.onSale ? (
          <span className="text-sm text-muted-foreground line-through">
            <span className="sr-only">{productTexts.regularPrice}: </span>
            {formatMoney(price.regular)}
          </span>
        ) : null}
      </div>
      {price.lowest30Days ? (
        <p className="text-xs text-muted-foreground">
          {productTexts.lowest30Days} {formatMoney(price.lowest30Days)}
        </p>
      ) : null}
    </div>
  );
}
