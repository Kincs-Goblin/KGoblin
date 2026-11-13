"use client";

import { MotionConfig } from "motion/react";

/** A `prefers-reduced-motion` beállítást minden Motion-animáció tiszteletben tartja. */
export function MotionProvider({ children }: { children: React.ReactNode }) {
  return <MotionConfig reducedMotion="user">{children}</MotionConfig>;
}
