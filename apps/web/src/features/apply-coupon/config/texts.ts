export const applyCouponTexts = {
  heading: "Kuponkód",
  inputLabel: "Kuponkód megadása",
  placeholder: "Pl. GOBLIN10",
  submit: "Alkalmazás",
  submitting: "Ellenőrzés...",
  emptyError: "Kérjük, adj meg egy kuponkódot.",
  appliedHeading: "Alkalmazott kuponok",
  remove: (code: string) => `${code.toUpperCase()} kupon eltávolítása`,
  removeShort: "Eltávolítás",
  appliedToast: (code: string) => `Kupon alkalmazva: ${code.toUpperCase()}`,
  removedToast: (code: string) => `Kupon eltávolítva: ${code.toUpperCase()}`,
} as const;
