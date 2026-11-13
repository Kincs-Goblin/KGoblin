"use client";

import { motion, type HTMLMotionProps } from "motion/react";

import { duration, easing } from "./tokens";

type RevealProps = HTMLMotionProps<"div"> & {
  /** Késleltetés másodpercben (pl. lépcsőzetes belépéshez). */
  delay?: number;
  /**
   * `false`: csak felúszik, nem tűnik át. Az oldal fő (LCP) elemén így használd, hogy a szerver HTML-je
   * JavaScript nélkül is látható tartalmat adjon.
   */
  fade?: boolean;
};

/**
 * Finom felúszó belépés. Csak `opacity` és `transform` animálódik; csökkentett mozgásnál a
 * `MotionConfig reducedMotion="user"` a transformot kikapcsolja, az áttűnés marad.
 */
export function Reveal({ delay = 0, fade = true, children, ...props }: RevealProps) {
  return (
    <motion.div
      initial={{ opacity: fade ? 0 : 1, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: duration.slow, ease: easing.out, delay }}
      {...props}
    >
      {children}
    </motion.div>
  );
}
