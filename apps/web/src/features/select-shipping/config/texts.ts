export const selectShippingTexts = {
  heading: "Szállítási mód",
  postcodeLabel: "Irányítószám",
  postcodePlaceholder: "Pl. 1053",
  countryLabel: "Ország",
  calculate: "Szállítás kalkulálása",
  calculating: "Kalkuláció...",
  postcodeError: "Kérjük, adj meg érvényes irányítószámot (pl. 1053).",
  postcodeUpdated: "Szállítási díjak frissítve a megadott irányítószám alapján.",
  freeShippingRemaining: (remainingFormatted: string) =>
    `Még ${remainingFormatted} az ingyenes szállításig`,
  freeShippingUnlocked: "Elérted az ingyenes szállítást!",
  freeLabel: "Ingyenes",
  noRates: "A megadott címhez jelenleg nincs elérhető szállítási mód.",
  pickupSlotHeading: "Csomagpont / csomagautomata kiválasztása",
  pickupSlotNote:
    "A csomagpont-választó térkép (GLS, Foxpost, Packeta) a következő fázisban érkezik — a választott szállítási módot már rögzítettük.",
  countries: [
    { code: "HU", label: "Magyarország (HU)" },
    { code: "SK", label: "Szlovákia (SK)" },
    { code: "AT", label: "Ausztria (AT)" },
    { code: "RO", label: "Románia (RO)" },
  ],
} as const;
