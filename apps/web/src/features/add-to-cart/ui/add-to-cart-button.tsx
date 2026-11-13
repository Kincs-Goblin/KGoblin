"use client";

import { CheckIcon, ShoppingBagIcon } from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import { useEffect, useState } from "react";
import { toast } from "sonner";

import { useCart } from "@/entities/cart";
import type { MoneyParts } from "@/shared/lib/format";
import { cn } from "@/shared/lib/utils";
import { Button } from "@/shared/ui/button";
import { duration, spring } from "@/shared/ui/motion";

import { addToCartTexts } from "../config/texts";

type AddToCartButtonProps = {
  product: { id: number; slug: string; name: string; price: MoneyParts };
  disabled?: boolean;
  size?: "default" | "lg";
  className?: string;
};

export function AddToCartButton({
  product,
  disabled,
  size = "default",
  className,
}: AddToCartButtonProps) {
  const { dispatch } = useCart();
  const [added, setAdded] = useState(false);

  useEffect(() => {
    if (!added) return;
    const timer = setTimeout(() => setAdded(false), 1400);
    return () => clearTimeout(timer);
  }, [added]);

  function handleClick() {
    dispatch({
      type: "add",
      line: {
        productId: product.id,
        slug: product.slug,
        name: product.name,
        unitPrice: product.price,
      },
    });
    setAdded(true);
    toast.success(addToCartTexts.toast(product.name));
  }

  return (
    <motion.div whileTap={disabled ? undefined : { scale: 0.96 }} transition={spring.snappy}>
      <Button
        type="button"
        size={size}
        disabled={disabled}
        onClick={handleClick}
        aria-label={disabled ? addToCartTexts.unavailable : addToCartTexts.labelFor(product.name)}
        className={cn(
          "w-full overflow-hidden",
          size === "lg" ? "h-12 text-base" : "h-9",
          className,
        )}
      >
        <AnimatePresence mode="wait" initial={false}>
          <motion.span
            key={added ? "added" : "idle"}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: duration.fast }}
            className="flex items-center gap-2"
          >
            {added ? <CheckIcon aria-hidden="true" /> : <ShoppingBagIcon aria-hidden="true" />}
            {disabled
              ? addToCartTexts.unavailable
              : added
                ? addToCartTexts.added
                : addToCartTexts.add}
          </motion.span>
        </AnimatePresence>
      </Button>
    </motion.div>
  );
}
