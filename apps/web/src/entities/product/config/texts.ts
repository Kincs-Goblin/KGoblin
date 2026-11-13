export const productTexts = {
  rarity: {
    common: "Gyakori",
    rare: "Ritka",
    epic: "Epikus",
    legendary: "Legendás",
  },
  onSale: "Akció",
  regularPrice: "Eredeti ár",
  lowest30Days: "Az elmúlt 30 nap legalacsonyabb ára:",
  inStock: "Raktáron",
  lowStock: (count: number) => `Már csak ${count} db`,
  outOfStock: "Elfogyott",
  noImage: "Kép hamarosan",
} as const;
