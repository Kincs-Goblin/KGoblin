"use client";

import { TagIcon, XIcon } from "lucide-react";
import { useId, useState, type FormEvent } from "react";
import { toast } from "sonner";

import { useCart } from "@/entities/cart";
import { formatMoney } from "@/shared/lib/format";
import { Button } from "@/shared/ui/button";
import { Input } from "@/shared/ui/input";

import { applyCouponTexts } from "../config/texts";

export function CouponForm({
  locale,
  compact = false,
}: { locale?: string; compact?: boolean } = {}) {
  const { cart, applyCoupon, removeCoupon } = useCart();
  const [code, setCode] = useState("");
  const [fieldError, setFieldError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [removingCode, setRemovingCode] = useState<string | null>(null);
  const inputId = useId();
  const errorId = useId();

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (submitting) return;
    const trimmed = code.trim();
    if (!trimmed) {
      setFieldError(applyCouponTexts.emptyError);
      return;
    }

    setFieldError(null);
    setSubmitting(true);
    const result = await applyCoupon(trimmed);
    setSubmitting(false);

    if (result.ok) {
      setCode("");
      toast.success(applyCouponTexts.appliedToast(trimmed));
    } else {
      setFieldError(result.message);
    }
  }

  async function handleRemove(couponCode: string) {
    if (removingCode !== null) return;
    setRemovingCode(couponCode);
    const result = await removeCoupon(couponCode);
    setRemovingCode(null);
    if (result.ok) {
      toast.success(applyCouponTexts.removedToast(couponCode));
    }
  }

  return (
    <section
      className={
        compact
          ? "rounded-lg border border-bronze/40 bg-surface-wood-dark/40 p-3"
          : "surface-wood rounded-xl border border-bronze/40 p-4"
      }
    >
      <h2
        className={
          compact
            ? "flex items-center gap-1.5 font-heading text-xs font-bold tracking-wide text-muted-foreground uppercase"
            : "flex items-center gap-2 font-heading text-base font-bold text-foreground"
        }
      >
        <TagIcon className="size-4 text-gold" aria-hidden="true" />
        {applyCouponTexts.heading}
      </h2>

      <form onSubmit={handleSubmit} className="mt-3 flex flex-col gap-2 sm:flex-row" noValidate>
        <div className="flex-1">
          <label htmlFor={inputId} className="sr-only">
            {applyCouponTexts.inputLabel}
          </label>
          <Input
            id={inputId}
            name="coupon"
            type="text"
            value={code}
            onChange={(event) => {
              setCode(event.target.value);
              if (fieldError) setFieldError(null);
            }}
            placeholder={applyCouponTexts.placeholder}
            autoComplete="off"
            aria-invalid={fieldError ? true : undefined}
            aria-describedby={fieldError ? errorId : undefined}
            disabled={submitting}
            className="h-10 uppercase placeholder:normal-case"
          />
        </div>
        <Button type="submit" disabled={submitting} className="h-10 shrink-0">
          {submitting ? applyCouponTexts.submitting : applyCouponTexts.submit}
        </Button>
      </form>

      {fieldError ? (
        <p id={errorId} role="alert" className="mt-2 text-sm text-destructive">
          {fieldError}
        </p>
      ) : null}

      {cart.coupons.length > 0 ? (
        <div className="mt-4 border-t border-border/40 pt-3">
          <p className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
            {applyCouponTexts.appliedHeading}
          </p>
          <ul className="mt-2 flex flex-col gap-2">
            {cart.coupons.map((coupon) => (
              <li
                key={coupon.code}
                className="flex items-center justify-between gap-2 rounded-lg border border-gold/40 bg-surface-wood-dark/50 px-3 py-2 text-sm"
              >
                <div className="flex items-center gap-2">
                  <span className="font-heading font-semibold text-gold uppercase">
                    {coupon.code}
                  </span>
                  <span className="text-muted-foreground">
                    −{formatMoney(coupon.totalDiscount, locale)}
                  </span>
                </div>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  disabled={removingCode === coupon.code}
                  aria-label={applyCouponTexts.remove(coupon.code)}
                  onClick={() => handleRemove(coupon.code)}
                  className="h-7 gap-1 px-2 text-xs text-muted-foreground hover:text-destructive"
                >
                  <XIcon className="size-3.5" aria-hidden="true" />
                  {applyCouponTexts.removeShort}
                </Button>
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </section>
  );
}
