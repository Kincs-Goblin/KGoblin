import { errorCatalog } from "@/shared/lib/errors";

export const errorTexts = {
  title: "Elszakadt a varázsfonal",
  description: errorCatalog["APP.UNEXPECTED"].message,
  retry: "Újrapróbálom",
} as const;
