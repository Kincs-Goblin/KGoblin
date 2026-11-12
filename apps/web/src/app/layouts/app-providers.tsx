"use client";

import { MotionProvider } from "@/shared/ui/motion";
import { Toaster } from "@/shared/ui/sonner";

export function AppProviders({ children }: { children: React.ReactNode }) {
  return (
    <MotionProvider>
      {children}
      <Toaster position="bottom-right" />
    </MotionProvider>
  );
}
