import type { Rarity } from "@/entities/product";

export const homeTexts = {
  featuredHeading: "Friss zsákmány",
  featuredMore: "Mind a kincstárban",
  categoriesHeading: "Kincseskamrák",
  errorTitle: "A kincstár ajtaja most zárva",
  rarityHeading: "Minden zsákmánynak megvan a ritkasága",
  rarityIntro:
    "A termékeken jelöljük, mennyire különleges egy darab - a mindennapi kellékektől a legendás ritkaságokig.",
  rarityDescriptions: {
    common: "Alapfelszerelés minden kalandhoz.",
    rare: "Ezekért már megéri lehajolni.",
    epic: "Gyűjtők szeme ilyenkor felcsillan.",
    legendary: "Kevés készül belőle, gyorsan elkel.",
  } satisfies Record<Rarity, string>,
} as const;
