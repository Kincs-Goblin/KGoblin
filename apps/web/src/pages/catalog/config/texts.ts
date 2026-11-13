import type { SortKey } from "../model/query";

export const catalogTexts = {
  allTitle: "Minden zsákmány",
  allIntro: "A kincstár teljes kínálata, frissen a raktárból.",
  breadcrumbHome: "Főoldal",
  breadcrumbLabel: "Morzsamenü",
  filtersLabel: "Szűrés és rendezés",
  categoriesLabel: "Kategóriák",
  allCategories: "Mind",
  onSaleOnly: "Csak akciós",
  sortLabel: "Rendezés",
  sort: {
    ajanlott: "Ajánlott",
    "ar-novekvo": "Ár szerint növekvő",
    "ar-csokkeno": "Ár szerint csökkenő",
    nevsor: "Név szerint",
    uj: "Legújabb",
  } satisfies Record<SortKey, string>,
  resultCount: (count: number) => `${count} termék`,
  errorTitle: "A kincstár ajtaja most zárva",
} as const;
