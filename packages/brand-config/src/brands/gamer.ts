import type { Brand } from "../schema";

/**
 * Gamer brand: fantasy-kocsma hangulat (sötét fa, kő, arany keretek, meleg fények).
 * A tokenek saját értékek; védett játék-asset (logó, betűtípus, kép) nem kerül ide.
 */
export const gamer = {
  id: "gamer",
  name: "KincsGoblin",
  // TODO(KG): az éles és a demo domain, amint megvan.
  domains: ["gamer.localhost"],
  woo: {
    baseUrlEnv: "WOO_GAMER_URL",
  },
  locale: "hu-HU",
  currency: "HUF",
  theme: {
    colors: {
      background: "oklch(0.19 0.025 50)",
      foreground: "oklch(0.94 0.03 85)",
      card: "oklch(0.25 0.035 52)",
      "card-foreground": "oklch(0.94 0.03 85)",
      popover: "oklch(0.23 0.03 52)",
      "popover-foreground": "oklch(0.94 0.03 85)",
      primary: "oklch(0.8 0.14 82)",
      "primary-foreground": "oklch(0.2 0.04 55)",
      secondary: "oklch(0.35 0.05 55)",
      "secondary-foreground": "oklch(0.94 0.03 85)",
      muted: "oklch(0.29 0.03 52)",
      "muted-foreground": "oklch(0.78 0.035 80)",
      accent: "oklch(0.37 0.06 58)",
      "accent-foreground": "oklch(0.96 0.03 85)",
      destructive: "oklch(0.62 0.2 27)",
      "destructive-foreground": "oklch(0.98 0.01 85)",
      border: "oklch(0.52 0.08 65)",
      input: "oklch(0.36 0.04 55)",
      ring: "oklch(0.82 0.15 82)",
      gold: "oklch(0.8 0.14 82)",
      "gold-foreground": "oklch(0.2 0.04 55)",
      bronze: "oklch(0.58 0.09 60)",
      mana: "oklch(0.68 0.15 245)",
      "rarity-common": "oklch(0.88 0.01 90)",
      "rarity-rare": "oklch(0.7 0.15 250)",
      "rarity-epic": "oklch(0.68 0.2 310)",
      "rarity-legendary": "oklch(0.8 0.16 65)",
      "surface-wood": "oklch(0.3 0.05 50)",
      "surface-wood-dark": "oklch(0.22 0.04 48)",
      "surface-stone": "oklch(0.33 0.012 70)",
      glow: "oklch(0.85 0.15 80 / 0.55)",
    },
    radius: "0.75rem",
    shadows: {
      card: "0 10px 30px -12px oklch(0.05 0.02 50 / 0.8), inset 0 1px 0 oklch(1 0 0 / 0.06)",
      glow: "0 0 24px 2px oklch(0.85 0.15 80 / 0.45)",
    },
    fonts: {
      heading: "cinzel",
      body: "alegreya-sans",
    },
  },
  texts: {
    tagline: "Kincsek kalandoroknak",
    heroTitle: "Lépj be a Goblin kocsmájába",
    heroSubtitle:
      "Kártyák, kockák, figurák és gamer felszerelés - válogatott zsákmány, gyors szállítással.",
    heroCta: "Irány a zsákmány",
    footerNote: "A KincsGoblin független webshop, nem áll kapcsolatban egyetlen játékkiadóval sem.",
  },
  payments: ["stripe", "barion", "simplepay"],
  merchandising: {
    // HUF, minor unit = Ft.
    rarityThresholds: { rare: 20000, epic: 35000, legendary: 50000 },
  },
  search: {
    index: "products_gamer",
  },
} satisfies Brand;
