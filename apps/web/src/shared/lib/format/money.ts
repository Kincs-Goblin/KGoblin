export type MoneyParts = {
  /** Minor unitban, ahogy a Store API adja (pl. "16990"). */
  amount: string;
  currency: string;
  minorUnit: number;
};

const ZERO_DECIMAL_CURRENCIES = new Set(["HUF", "JPY", "KRW", "VND", "ISK", "CLP"]);
const THREE_DECIMAL_CURRENCIES = new Set(["BHD", "JOD", "KWD", "OMR", "TND"]);

export function getCurrencyMinorUnit(currency: string): number {
  const code = currency.toUpperCase();
  if (ZERO_DECIMAL_CURRENCIES.has(code)) return 0;
  if (THREE_DECIMAL_CURRENCIES.has(code)) return 3;
  return 2;
}

export function getCurrencyLabel(currency: string, locale = "hu-HU"): string {
  return (
    new Intl.NumberFormat(locale, { style: "currency", currency })
      .formatToParts(0)
      .find((part) => part.type === "currency")?.value ?? currency
  );
}

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
