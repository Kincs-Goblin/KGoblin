"use client";

import { useCart } from "@/entities/cart";
import { formatMoney } from "@/shared/lib/format";
import { cn } from "@/shared/lib/utils";

import { selectShippingTexts } from "../config/texts";

export function FreeShippingBanner({
  locale,
  compact = false,
  className,
}: {
  locale?: string;
  compact?: boolean;
  className?: string;
}) {
  const { cart } = useCart();
  const progress = cart.freeShippingProgress;
  if (!progress) return null;

  return (
    <div
      className={cn(
        compact
          ? "border-b border-border/40 bg-surface-wood-dark/50 px-4 py-2 text-xs text-foreground"
          : "rounded-lg border border-gold/30 bg-surface-wood-dark/50 p-3",
        className,
      )}
      data-testid="free-shipping-banner"
    >
      <p className={cn(compact ? "font-medium" : "text-sm font-medium text-foreground")}>
        {progress.eligible
          ? selectShippingTexts.freeShippingUnlocked
          : selectShippingTexts.freeShippingRemaining(formatMoney(progress.remaining, locale))}
      </p>
      <div
        role="progressbar"
        aria-valuenow={progress.progressPercent}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-label={selectShippingTexts.heading}
        className={cn(
          "w-full overflow-hidden rounded-full bg-border/50",
          compact ? "mt-1.5 h-1.5" : "mt-2 h-2",
        )}
      >
        <div
          className="h-full rounded-full bg-gold transition-all duration-300"
          style={{ width: `${progress.progressPercent}%` }}
        />
      </div>
    </div>
  );
}
