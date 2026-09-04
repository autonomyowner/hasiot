/**
 * Display currency.
 *
 * Every price in the product — a nightly rate, a quote, a booking total — is
 * *stored* in Saudi riyals, and hosts always *enter* riyals. Only the display
 * converts, which is why nothing here ever runs on the way into the backend.
 */

/**
 * The Saudi riyal has been pegged to the US dollar at 3.75 SAR/USD since 1986.
 * It is a constant, not a rate: there is no exchange-rate API to call, and a
 * stale value is impossible.
 */
export const SAR_PER_USD = 3.75;

export type Currency = "SAR" | "USD";

/** Unit labels, localised — `t("sar")` / `t("usd")`. */
export interface CurrencyUnit {
  sar: string;
  usd: string;
}

/**
 * A stored riyal amount in the target currency. Dollars are rounded to a whole
 * dollar: these are nightly rates and stay totals, and "$120" reads as a price
 * where "$119.87" reads as a conversion.
 */
export function convertFromSar(amountSar: number, to: Currency): number {
  if (to === "USD") return Math.round(amountSar / SAR_PER_USD);
  return amountSar;
}

/**
 * A stored riyal amount, formatted for display — `"450 SAR"` / `"$120"`.
 *
 * Grouping is `en-US` for both, matching the totals the app already renders;
 * Arabic-Indic digits are not used anywhere in this product.
 */
export function formatPrice(
  amountSar: number,
  currency: Currency,
  unit: CurrencyUnit
): string {
  const amount = convertFromSar(amountSar, currency).toLocaleString("en-US");
  // The dollar sign is the label for USD, so `unit.usd` stays unrendered here —
  // it names the currency in Settings instead.
  if (currency === "USD") return `$${amount}`;
  return `${amount} ${unit.sar}`;
}
