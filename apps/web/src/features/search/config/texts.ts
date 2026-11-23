export const searchFeatureTexts = {
  label: "Keresés a termékek között",
  placeholder: "Keress terméket, kategóriát…",
  clearLabel: "Keresés törlése",
  submitLabel: "Keresés indítása",
  listboxLabel: "Keresési javaslatok",
  loading: "Keresés…",
  empty: "Nincs találat erre a kifejezésre.",
  error: "A keresés átmenetileg nem érhető el.",
  viewAll: (total: number) => `Összes találat megtekintése (${total})`,
  outOfStock: "Elfogyott",
} as const;
