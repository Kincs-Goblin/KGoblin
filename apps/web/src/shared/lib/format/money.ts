export type MoneyParts = {
  /** Minor unitban, ahogy a Store API adja (pl. "16990"). */
  amount: string;
  currency: string;
  minorUnit: number;
};

/**
 * Pénzösszeg megjelenítése. Csak formáz, nem számol: az összeget a Woo adja minor unitban.
 */
export function formatMoney({ amount, currency, minorUnit }: MoneyParts, locale = "hu-HU"): string {
  const padded = amount.padStart(minorUnit + 1, "0");
  const major =
    minorUnit > 0 ? `${padded.slice(0, -minorUnit)}.${padded.slice(-minorUnit)}` : padded;
  return new Intl.NumberFormat(locale, {
    style: "currency",
    currency,
    minimumFractionDigits: minorUnit,
    maximumFractionDigits: minorUnit,
  }).format(Number(major));
}
