"use client";

import { CartProvider } from "@/entities/cart";
import { MotionProvider } from "@/shared/ui/motion";
import { Toaster } from "@/shared/ui/sonner";

export function AppProviders({
  brandId,
  children,
}: {
  brandId: string;
  children: React.ReactNode;
}) {
  return (
    <MotionProvider>
      <CartProvider brandId={brandId}>
        {children}
        <Toaster position="top-center" />
      </CartProvider>
    </MotionProvider>
  );
}
