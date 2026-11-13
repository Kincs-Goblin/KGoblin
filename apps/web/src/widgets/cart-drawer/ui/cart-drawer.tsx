"use client";

import { MinusIcon, PlusIcon, ShoppingBagIcon, Trash2Icon } from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import Link from "next/link";
import { useState } from "react";

import { MAX_QUANTITY_PER_LINE, useCart } from "@/entities/cart";
import { routes } from "@/shared/config";
import { formatMoney } from "@/shared/lib/format";
import { Button } from "@/shared/ui/button";
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

/** A fejléc kosár-gombja és a jobbról beúszó kosár. Összeget nem számol (`totalsNote`). */
export function CartDrawer() {
  const { state, itemCount, dispatch } = useCart();
  const [open, setOpen] = useState(false);

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

        <div className="flex-1 overflow-y-auto px-4 py-3">
          {state.lines.length === 0 ? (
            <p className="py-10 text-center text-muted-foreground">{cartDrawerTexts.empty}</p>
          ) : (
            <ul className="flex flex-col gap-3">
              <AnimatePresence initial={false}>
                {state.lines.map((line) => (
                  <motion.li
                    key={line.productId}
                    layout
                    initial={{ opacity: 0, x: 24 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: 24 }}
                    transition={{ duration: duration.base, ease: easing.out }}
                    className="surface-wood rounded-lg border border-bronze/40 p-3"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <Link
                        href={routes.product(line.slug)}
                        onClick={() => setOpen(false)}
                        className="font-heading text-sm leading-snug text-foreground hover:text-gold"
                      >
                        {line.name}
                      </Link>
                      <Button
                        variant="ghost"
                        size="icon-sm"
                        aria-label={cartDrawerTexts.remove(line.name)}
                        onClick={() => dispatch({ type: "remove", productId: line.productId })}
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
                          aria-label={cartDrawerTexts.decrease(line.name)}
                          onClick={() =>
                            dispatch({
                              type: "setQuantity",
                              productId: line.productId,
                              quantity: line.quantity - 1,
                            })
                          }
                        >
                          <MinusIcon />
                        </Button>
                        <span
                          className="w-8 text-center font-heading tabular-nums"
                          aria-live="polite"
                        >
                          {line.quantity}
                        </span>
                        <Button
                          variant="outline"
                          size="icon-sm"
                          disabled={line.quantity >= MAX_QUANTITY_PER_LINE}
                          aria-label={cartDrawerTexts.increase(line.name)}
                          onClick={() =>
                            dispatch({
                              type: "setQuantity",
                              productId: line.productId,
                              quantity: line.quantity + 1,
                            })
                          }
                        >
                          <PlusIcon />
                        </Button>
                      </div>
                      <p className="text-right text-sm">
                        <span className="block text-xs text-muted-foreground">
                          {cartDrawerTexts.unitPrice}
                        </span>
                        <span className="font-heading text-gold">
                          {formatMoney(line.unitPrice)}
                        </span>
                      </p>
                    </div>
                  </motion.li>
                ))}
              </AnimatePresence>
            </ul>
          )}
        </div>

        <SheetFooter className="border-t border-border/50">
          <p className="text-xs text-muted-foreground">{cartDrawerTexts.totalsNote}</p>
          <Button size="lg" disabled className="h-11">
            {cartDrawerTexts.checkout}
          </Button>
          <SheetClose render={<Button variant="ghost" />}>{cartDrawerTexts.continue}</SheetClose>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}
