"use client";

import { MinusIcon, PlusIcon, ShoppingBagIcon, Trash2Icon } from "lucide-react";
import Link from "next/link";
import { useState } from "react";

import { MAX_QUANTITY_PER_LINE, useCart } from "@/entities/cart";
import { CouponForm } from "@/features/apply-coupon";
import { ShippingSelector } from "@/features/select-shipping";
import { routes } from "@/shared/config";
import { formatMoney } from "@/shared/lib/format";
import { Button, buttonVariants } from "@/shared/ui/button";

import { cartPageTexts } from "../config/texts";

export function CartPageContent({ locale }: { locale: string }) {
  const { cart, loading, pendingKeys, updateItemQuantity, removeItem, clearCart } = useCart();
  const [clearing, setClearing] = useState(false);

  const hasDiscount = Number.parseInt(cart.totals.discount.amount, 10) > 0;

  async function handleClear() {
    if (clearing) return;
    setClearing(true);
    await clearCart();
    setClearing(false);
  }

  if (loading && cart.items.length === 0) {
    return (
      <div className="mx-auto max-w-6xl px-4 py-12 sm:px-6">
        <h1 className="text-engraved font-heading text-3xl font-bold">{cartPageTexts.heading}</h1>
        <p className="mt-6 text-muted-foreground">{cartPageTexts.loading}</p>
      </div>
    );
  }

  if (cart.items.length === 0) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-16 text-center sm:px-6">
        <ShoppingBagIcon className="mx-auto size-12 text-gold/70" aria-hidden="true" />
        <h1 className="text-engraved mt-4 font-heading text-3xl font-bold">
          {cartPageTexts.emptyHeading}
        </h1>
        <p className="mt-2 text-muted-foreground">{cartPageTexts.emptyDescription}</p>
        <Link
          href={routes.products}
          className={buttonVariants({ size: "lg", className: "mt-6 h-11" })}
        >
          {cartPageTexts.browseProducts}
        </Link>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6 sm:py-10">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <h1 className="text-engraved font-heading text-3xl font-bold sm:text-4xl">
          {cartPageTexts.heading}
        </h1>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          disabled={clearing}
          onClick={handleClear}
          className="text-muted-foreground hover:text-destructive"
        >
          <Trash2Icon className="mr-1.5 size-4" aria-hidden="true" />
          {clearing ? cartPageTexts.clearingCart : cartPageTexts.clearCart}
        </Button>
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-[1fr_360px] lg:items-start">
        <div className="space-y-6">
          <ul className="space-y-3" aria-label={cartPageTexts.heading}>
            {cart.items.map((item) => {
              const variantLabel = item.variation.map((v) => v.value).join(", ");
              const displayName = variantLabel ? `${item.name} (${variantLabel})` : item.name;
              const isPending = clearing || pendingKeys.has(item.key);

              return (
                <li key={item.key} className="surface-wood rounded-xl border border-bronze/40 p-4">
                  <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                    <div className="min-w-0 flex-1">
                      {item.slug ? (
                        <Link
                          href={routes.product(item.slug)}
                          className="font-heading text-base font-semibold text-foreground hover:text-gold"
                        >
                          {item.name}
                        </Link>
                      ) : (
                        <span className="font-heading text-base font-semibold text-foreground">
                          {item.name}
                        </span>
                      )}
                      {variantLabel ? (
                        <p className="mt-1 text-sm text-muted-foreground">{variantLabel}</p>
                      ) : null}
                      <p className="mt-1 text-xs text-muted-foreground">
                        {cartPageTexts.unitPrice}:{" "}
                        <span className="tabular-nums">{formatMoney(item.unitPrice, locale)}</span>
                      </p>
                    </div>

                    <div className="flex items-center justify-between gap-4 sm:justify-end">
                      <div
                        className="flex items-center gap-1"
                        role="group"
                        aria-label={cartPageTexts.itemQuantity}
                      >
                        <Button
                          type="button"
                          variant="outline"
                          size="icon-sm"
                          disabled={isPending}
                          aria-label={cartPageTexts.decrease(displayName)}
                          onClick={() => void updateItemQuantity(item.key, item.quantity - 1)}
                        >
                          <MinusIcon />
                        </Button>
                        <span
                          className="w-9 text-center font-heading tabular-nums"
                          aria-live="polite"
                        >
                          {item.quantity}
                        </span>
                        <Button
                          type="button"
                          variant="outline"
                          size="icon-sm"
                          disabled={isPending || item.quantity >= MAX_QUANTITY_PER_LINE}
                          aria-label={cartPageTexts.increase(displayName)}
                          onClick={() => void updateItemQuantity(item.key, item.quantity + 1)}
                        >
                          <PlusIcon />
                        </Button>
                      </div>

                      <div className="min-w-24 text-right">
                        <span className="block text-xs text-muted-foreground">
                          {cartPageTexts.lineTotal}
                        </span>
                        <span className="font-heading text-base font-bold text-gold tabular-nums">
                          {formatMoney(item.lineTotal, locale)}
                        </span>
                      </div>

                      <Button
                        type="button"
                        variant="ghost"
                        size="icon-sm"
                        disabled={isPending}
                        aria-label={cartPageTexts.remove(displayName)}
                        onClick={() => void removeItem(item.key)}
                      >
                        <Trash2Icon />
                      </Button>
                    </div>
                  </div>
                </li>
              );
            })}
          </ul>

          <CouponForm locale={locale} />
          <ShippingSelector locale={locale} />
        </div>

        <aside
          aria-label={cartPageTexts.summaryHeading}
          className="frame-gold surface-wood rounded-2xl p-5 lg:sticky lg:top-28"
        >
          <h2 className="text-engraved font-heading text-xl font-bold">
            {cartPageTexts.summaryHeading}
          </h2>

          <dl className="mt-4 space-y-2.5 text-sm">
            <div className="flex justify-between gap-4 text-muted-foreground">
              <dt>{cartPageTexts.subtotal}</dt>
              <dd className="tabular-nums" data-testid="cart-subtotal">
                {formatMoney(cart.totals.items, locale)}
              </dd>
            </div>

            {hasDiscount ? (
              <div className="flex justify-between gap-4 text-gold">
                <dt>{cartPageTexts.discount}</dt>
                <dd className="tabular-nums" data-testid="cart-discount">
                  −{formatMoney(cart.totals.discount, locale)}
                </dd>
              </div>
            ) : null}

            <div className="flex justify-between gap-4 text-muted-foreground">
              <dt>{cartPageTexts.shipping}</dt>
              <dd className="tabular-nums" data-testid="cart-shipping">
                {cart.totals.shipping === null
                  ? cartPageTexts.shippingPending
                  : cart.totals.shipping.amount === "0"
                    ? cartPageTexts.shippingFree
                    : formatMoney(cart.totals.shipping, locale)}
              </dd>
            </div>

            <div className="flex justify-between gap-4 border-t border-border/50 pt-3 font-heading text-lg font-bold text-foreground">
              <dt>{cartPageTexts.total}</dt>
              <dd className="text-gold tabular-nums" data-testid="cart-total">
                {formatMoney(cart.totals.total, locale)}
              </dd>
            </div>
          </dl>

          <div className="mt-5 flex flex-col gap-2">
            <Button size="lg" disabled className="h-12 w-full">
              {cartPageTexts.checkoutSoon}
            </Button>
            <Link
              href={routes.products}
              className={buttonVariants({ variant: "ghost", className: "w-full" })}
            >
              {cartPageTexts.continueShopping}
            </Link>
          </div>
        </aside>
      </div>
    </div>
  );
}
