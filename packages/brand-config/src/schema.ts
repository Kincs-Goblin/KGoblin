import { z } from "zod";

/**
 * A témaértékek CSS-változóként kerülnek a lapra, ezért csak szűk, biztonságos karakterkészletet
 * engedünk (nincs `;`, `{`, `}`, `<`), hogy egy hibás config ne törhesse meg a stíluslapot.
 */
const cssValue = z
  .string()
  .min(1)
  .regex(/^[a-zA-Z0-9\s.,%()#/+\-"']+$/, "Nem biztonságos CSS-érték");

/** shadcn/ui kompatibilis színtokenek, plusz a saját (ritkaság, arany, mana) tokenek. */
export const colorTokenNames = [
  "background",
  "foreground",
  "card",
  "card-foreground",
  "popover",
  "popover-foreground",
  "primary",
  "primary-foreground",
  "secondary",
  "secondary-foreground",
  "muted",
  "muted-foreground",
  "accent",
  "accent-foreground",
  "destructive",
  "destructive-foreground",
  "border",
  "input",
  "ring",
  "gold",
  "gold-foreground",
  "bronze",
  "mana",
  "rarity-common",
  "rarity-rare",
  "rarity-epic",
  "rarity-legendary",
  "surface-wood",
  "surface-wood-dark",
  "surface-stone",
  "glow",
] as const;

export type ColorTokenName = (typeof colorTokenNames)[number];

const colorTokens = z.object(
  Object.fromEntries(colorTokenNames.map((name) => [name, cssValue])) as Record<
    ColorTokenName,
    typeof cssValue
  >,
);

/** A fontokat az app tölti be (`next/font`); a brand csak a kulcsot választja. */
export const fontKeys = ["cinzel", "alegreya-sans", "inter"] as const;
export type FontKey = (typeof fontKeys)[number];

export const themeSchema = z.object({
  colors: colorTokens,
  radius: cssValue,
  shadows: z.object({
    card: cssValue,
    glow: cssValue,
  }),
  fonts: z.object({
    heading: z.enum(fontKeys),
    body: z.enum(fontKeys),
  }),
});

export const brandSchema = z.object({
  id: z.string().regex(/^[a-z][a-z0-9-]*$/),
  name: z.string().min(1),
  domains: z.array(z.string().min(1)).min(1),
  woo: z.object({
    /** Az env-változó neve, nem az értéke. */
    baseUrlEnv: z.string().regex(/^[A-Z][A-Z0-9_]*$/),
  }),
  locale: z.string().min(2),
  currency: z.string().length(3),
  theme: themeSchema,
  texts: z.object({
    tagline: z.string().min(1),
    heroTitle: z.string().min(1),
    heroSubtitle: z.string().min(1),
    heroCta: z.string().min(1),
    footerNote: z.string().min(1),
  }),
  payments: z.array(z.enum(["stripe", "barion", "simplepay"])),
  search: z.object({
    index: z.string().min(1),
  }),
});

export type BrandTheme = z.infer<typeof themeSchema>;
export type Brand = z.infer<typeof brandSchema>;
