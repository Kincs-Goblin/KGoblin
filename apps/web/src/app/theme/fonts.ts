import type { FontKey } from "@kg/brand-config";
import { Alegreya_Sans, Cinzel, Inter } from "next/font/google";

// Szabad licencű (SIL OFL) fontok; a next/font build időben letölti és saját domainről szolgálja ki.
const cinzel = Cinzel({
  subsets: ["latin", "latin-ext"],
  weight: ["500", "700", "900"],
  variable: "--font-cinzel",
  display: "swap",
});

const alegreyaSans = Alegreya_Sans({
  subsets: ["latin", "latin-ext"],
  weight: ["400", "500", "700"],
  variable: "--font-alegreya-sans",
  display: "swap",
});

const inter = Inter({
  subsets: ["latin", "latin-ext"],
  variable: "--font-inter",
  display: "swap",
  preload: false,
});

export const fontVariableClasses = [cinzel.variable, alegreyaSans.variable, inter.variable].join(
  " ",
);

/** A brand font-kulcsához tartozó CSS-változó. */
export const fontVariableByKey: Record<FontKey, string> = {
  cinzel: "--font-cinzel",
  "alegreya-sans": "--font-alegreya-sans",
  inter: "--font-inter",
};
