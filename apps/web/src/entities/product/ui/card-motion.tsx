"use client";

import { motion } from "motion/react";

import { cn } from "@/shared/lib/utils";
import { duration, spring } from "@/shared/ui/motion";

import type { Rarity } from "../model/types";

const rarityRing: Record<Rarity, string> = {
  common: "",
  rare: "ring-1 ring-rarity-rare/40",
  epic: "ring-1 ring-rarity-epic/45",
  legendary: "ring-2 ring-rarity-legendary/60",
};

const rarityGlow: Record<Rarity, string> = {
  common: "shadow-[0_0_28px_2px_var(--glow)]",
  rare: "shadow-[0_0_28px_2px_var(--rarity-rare)]",
  epic: "shadow-[0_0_28px_2px_var(--rarity-epic)]",
  legendary: "shadow-[0_0_32px_4px_var(--rarity-legendary)]",
};

type CardMotionProps = {
  rarity: Rarity;
  className?: string;
  children: React.ReactNode;
};

/**
 * A termékkártya mozgása: hoverre felemelkedik, a ritkaság színében izzik; a legendás kártyán lassú
 * csillogás fut át. Csak `transform` és `opacity` animálódik; csökkentett mozgásnál a transform elmarad.
 */
export function CardMotion({ rarity, className, children }: CardMotionProps) {
  return (
    <motion.article
      initial="rest"
      animate="rest"
      whileHover="hover"
      variants={{ rest: { y: 0 }, hover: { y: -6 } }}
      transition={spring.gentle}
      className={cn(
        "frame-gold group relative flex h-full flex-col rounded-xl p-3 focus-within:ring-2 focus-within:ring-ring/60",
        rarityRing[rarity],
        className,
      )}
    >
      <motion.div
        aria-hidden="true"
        variants={{ rest: { opacity: 0 }, hover: { opacity: 0.7 } }}
        transition={{ duration: duration.base }}
        className={cn("pointer-events-none absolute inset-0 rounded-xl", rarityGlow[rarity])}
      />
      {rarity === "legendary" ? (
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 overflow-hidden rounded-xl"
        >
          <motion.div
            className="absolute inset-y-0 -left-1/2 w-1/3 -skew-x-12 bg-linear-to-r from-transparent via-rarity-legendary/25 to-transparent"
            animate={{ x: ["0%", "500%"] }}
            transition={{ duration: 2.8, ease: "easeInOut", repeat: Infinity, repeatDelay: 2.5 }}
          />
        </div>
      ) : null}
      <div className="relative flex h-full flex-col">{children}</div>
    </motion.article>
  );
}
