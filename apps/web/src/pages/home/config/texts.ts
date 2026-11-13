export const homeTexts = {
  rarityHeading: "Minden zsákmánynak megvan a ritkasága",
  rarityIntro:
    "A termékeken jelöljük, mennyire különleges egy darab - a mindennapi kellékektől a legendás ritkaságokig.",
  rarities: [
    { variant: "common", label: "Gyakori", description: "Alapfelszerelés minden kalandhoz." },
    { variant: "rare", label: "Ritka", description: "Ezekért már megéri lehajolni." },
    { variant: "epic", label: "Epikus", description: "Gyűjtők szeme ilyenkor felcsillan." },
    { variant: "legendary", label: "Legendás", description: "Kevés készül belőle, gyorsan elkel." },
  ],
} as const;
