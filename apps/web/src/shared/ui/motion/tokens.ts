import type { Transition } from "motion/react";

/**
 * Közös animációs tokenek. Komponensben nem írunk egyedi időtartamot vagy rugót, hanem innen
 * választunk, hogy az egész shop egy ritmusban mozogjon.
 */
export const duration = {
  fast: 0.15,
  base: 0.25,
  slow: 0.45,
} as const;

export const easing = {
  /** Belépés: gyors indulás, puha megállás. */
  out: [0.22, 1, 0.36, 1],
  /** Kilépés: puha indulás, gyors vég. */
  in: [0.64, 0, 0.78, 0],
  inOut: [0.65, 0, 0.35, 1],
} as const satisfies Record<string, [number, number, number, number]>;

export const spring = {
  /** Gombok, számláló-felpattanás. */
  snappy: { type: "spring", stiffness: 520, damping: 30, mass: 0.8 },
  /** Kártyák, panelek. */
  gentle: { type: "spring", stiffness: 260, damping: 26 },
} as const satisfies Record<string, Transition>;

/** Lépcsőzetes megjelenés listaelemekre (másodpercben, elemenként). */
export const stagger = 0.05;
