"use client";

import { MinusIcon, PlusIcon, ShoppingBagIcon, Trash2Icon } from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import Link from "next/link";
import { useState } from "react";

import { MAX_QUANTITY_PER_LINE, useCart } from "@/entities/cart";
import { CouponForm } from "@/features/apply-coupon";
import { FreeShippingBanner } from "@/features/select-shipping";
import { routes } from "@/shared/config";
import { formatMoney } from "@/shared/lib/format";
import { Button, buttonVariants } from "@/shared/ui/button";
import { duration, easing, spring } from "@/shared/ui/motion";
import {
  Sheet,
  SheetClose,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/shared/ui/sheet";

import { cartDrawerTexts } from "../config/texts";

/** A fejléc kosár-gombja és a jobbról beúszó kosár valódi Store API BFF adatokkal. */
export function CartDrawer({ locale }: { locale?: string } = {}) {
  const { cart, itemCount, loading, pendingKeys, updateItemQuantity, removeItem } = useCart();
  const [open, setOpen] = useState(false);

  const hasDiscount = Number.parseInt(cart.totals.discount.amount, 10) > 0;

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger
        render={
          <Button
            variant="outline"
            size="icon-lg"
            aria-label={cartDrawerTexts.open(itemCount)}
            className="relative size-11 border-gold/60 bg-surface-wood-dark/60"
          />
        }
      >
        <ShoppingBagIcon className="size-5 text-gold" />
        <AnimatePresence initial={false}>
          {itemCount > 0 ? (
            <motion.span
              key={itemCount}
              data-testid="cart-count"
              initial={{ scale: 0.4, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.4, opacity: 0 }}
              transition={spring.snappy}
              className="absolute -top-1.5 -right-1.5 flex min-w-5 items-center justify-center rounded-full bg-rarity-legendary px-1 text-xs font-bold text-gold-foreground shadow-glow"
            >
              {itemCount}
            </motion.span>
          ) : null}
        </AnimatePresence>
      </SheetTrigger>

      <SheetContent side="right" className="frame-gold w-full gap-0 sm:max-w-md">
        <SheetHeader className="border-b border-border/50">
          <SheetTitle className="text-engraved font-heading text-xl">
            {cartDrawerTexts.title}
          </SheetTitle>
          <SheetDescription>{cartDrawerTexts.description}</SheetDescription>
        </SheetHeader>

        <FreeShippingBanner locale={locale} compact />

        <div className="flex-1 overflow-y-auto px-4 py-3">
          {loading && cart.items.length === 0 ? (
            <p className="py-10 text-center text-muted-foreground">{cartDrawerTexts.loading}</p>
          ) : cart.items.length === 0 ? (
            <p className="py-10 text-center text-muted-foreground">{cartDrawerTexts.empty}</p>
          ) : (
            <ul className="flex flex-col gap-3">
              <AnimatePresence initial={false}>
                {cart.items.map((item) => {
                  const variantLabel = item.variation.map((v) => v.value).join(", ");
                  const displayName = variantLabel ? `${item.name} (${variantLabel})` : item.name;
                  const isPending = pendingKeys.has(item.key);
                  return (
                    <motion.li
                      key={item.key}
                      layout
                      initial={{ opacity: 0, x: 24 }}
                      animate={{ opacity: 1, x: 0 }}
                      exit={{ opacity: 0, x: 24 }}
                      transition={{ duration: duration.base, ease: easing.out }}
                      className="surface-wood rounded-lg border border-bronze/40 p-3"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          {item.slug ? (
                            <Link
                              href={routes.product(item.slug)}
                              onClick={() => setOpen(false)}
                              className="font-heading text-sm leading-snug text-foreground hover:text-gold"
                            >
                              {item.name}
                            </Link>
                          ) : (
                            <span className="font-heading text-sm leading-snug text-foreground">
                              {item.name}
                            </span>
                          )}
                          {variantLabel ? (
                            <p className="mt-0.5 text-xs text-muted-foreground">{variantLabel}</p>
                          ) : null}
                        </div>
                        <Button
                          variant="ghost"
                          size="icon-sm"
                          disabled={isPending}
                          aria-label={cartDrawerTexts.remove(displayName)}
                          onClick={() => void removeItem(item.key)}
                        >
                          <Trash2Icon />
                        </Button>
                      </div>
                      <div className="mt-2 flex items-center justify-between gap-3">
                        <div
                          className="flex items-center gap-1"
                          role="group"
                          aria-label={cartDrawerTexts.quantity}
                        >
                          <Button
                            variant="outline"
                            size="icon-sm"
                            disabled={isPending}
                            aria-label={cartDrawerTexts.decrease(displayName)}
                            onClick={() => void updateItemQuantity(item.key, item.quantity - 1)}
                          >
                            <MinusIcon />
                          </Button>
                          <span
                            className="w-8 text-center font-heading tabular-nums"
                            aria-live="polite"
                          >
                            {item.quantity}
                          </span>
                          <Button
                            variant="outline"
                            size="icon-sm"
                            disabled={isPending || item.quantity >= MAX_QUANTITY_PER_LINE}
                            aria-label={cartDrawerTexts.increase(displayName)}
                            onClick={() => void updateItemQuantity(item.key, item.quantity + 1)}
                          >
                            <PlusIcon />
                          </Button>
                        </div>
                        <p className="text-right text-sm">
                          <span className="block text-xs text-muted-foreground">
                            {cartDrawerTexts.lineTotal}
                          </span>
                          <span className="font-heading text-gold tabular-nums">
                            {formatMoney(item.lineTotal, locale)}
                          </span>
                        </p>
                      </div>
                    </motion.li>
                  );
                })}
              </AnimatePresence>
            </ul>
          )}
          {cart.items.length > 0 ? (
            <div className="mt-4">
              <CouponForm locale={locale} compact />
            </div>
          ) : null}
        </div>

        <SheetFooter className="border-t border-border/50">
          {cart.items.length > 0 ? (
            <dl className="mb-2 space-y-1 text-sm">
              <div className="flex justify-between text-muted-foreground">
                <dt>{cartDrawerTexts.subtotal}</dt>
                <dd className="tabular-nums">{formatMoney(cart.totals.items, locale)}</dd>
              </div>
              {hasDiscount ? (
                <div className="flex justify-between text-gold">
                  <dt>{cartDrawerTexts.discount}</dt>
                  <dd className="tabular-nums">−{formatMoney(cart.totals.discount, locale)}</dd>
                </div>
              ) : null}
              {cart.totals.shipping !== null ? (
                <div className="flex justify-between text-muted-foreground">
                  <dt>{cartDrawerTexts.shipping}</dt>
                  <dd className="tabular-nums">
                    {cart.totals.shipping.amount === "0"
                      ? cartDrawerTexts.shippingFree
                      : formatMoney(cart.totals.shipping, locale)}
                  </dd>
                </div>
              ) : null}
              <div className="flex justify-between border-t border-border/40 pt-1.5 font-heading text-base font-bold text-foreground">
                <dt>{cartDrawerTexts.total}</dt>
                <dd className="text-gold tabular-nums" data-testid="drawer-total">
                  {formatMoney(cart.totals.total, locale)}
                </dd>
              </div>
            </dl>
          ) : null}

          <Link
            href={routes.cart}
            onClick={() => setOpen(false)}
            className={buttonVariants({ size: "lg", className: "h-11 w-full" })}
          >
            {cartDrawerTexts.viewCart}
          </Link>
          <Button size="lg" variant="outline" disabled className="h-10">
            {cartDrawerTexts.checkout}
          </Button>
          <SheetClose render={<Button variant="ghost" />}>{cartDrawerTexts.continue}</SheetClose>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}
