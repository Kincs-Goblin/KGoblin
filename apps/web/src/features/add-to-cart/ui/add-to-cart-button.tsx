"use client";

import { CheckIcon, Loader2Icon, ShoppingBagIcon } from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import { useEffect, useState } from "react";
import { toast } from "sonner";

import { useCart } from "@/entities/cart";
import { cn } from "@/shared/lib/utils";
import { Button } from "@/shared/ui/button";
import { duration, spring } from "@/shared/ui/motion";

import { addToCartTexts } from "../config/texts";

type AddToCartButtonProps = {
  product: {
    id: number;
    variationId?: number;
    variantLabel?: string;
    variation?: Array<{ attribute: string; value: string }>;
    slug: string;
    name: string;
  };
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
  const { addItem } = useCart();
  const [added, setAdded] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!added) return;
    const timer = setTimeout(() => setAdded(false), 1400);
    return () => clearTimeout(timer);
  }, [added]);

  async function handleClick() {
    if (submitting || disabled) return;
    setSubmitting(true);
    const result = await addItem({
      id: product.variationId ?? product.id,
      quantity: 1,
      ...(product.variation?.length ? { variation: product.variation } : {}),
    });
    setSubmitting(false);

    if (result.ok) {
      setAdded(true);
      toast.success(
        addToCartTexts.toast(
          product.variantLabel ? `${product.name} (${product.variantLabel})` : product.name,
        ),
      );
    } else {
      toast.error(result.message);
    }
  }

  const isDisabled = Boolean(disabled) || submitting;

  return (
    <motion.div whileTap={isDisabled ? undefined : { scale: 0.96 }} transition={spring.snappy}>
      <Button
        type="button"
        size={size}
        disabled={isDisabled}
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
            key={submitting ? "submitting" : added ? "added" : "idle"}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: duration.fast }}
            className="flex items-center gap-2"
          >
            {submitting ? (
              <Loader2Icon className="animate-spin" aria-hidden="true" />
            ) : added ? (
              <CheckIcon aria-hidden="true" />
            ) : (
              <ShoppingBagIcon aria-hidden="true" />
            )}
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
