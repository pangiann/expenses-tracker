/**
 * Money helpers. Formatting follows the page language (set once at start by main.tsx):
 * English shows "€1,234.50", Greek shows "1.234,50 €".
 * Rounding and sums are in shared/month/amounts.ts, because the Worker needs them too.
 */

let euroFormatter = new Intl.NumberFormat('en-IE', { style: 'currency', currency: 'EUR', maximumFractionDigits: 2 });
let percentFormatter = new Intl.NumberFormat('en-IE', {
  style: 'percent',
  minimumFractionDigits: 1,
  maximumFractionDigits: 1,
});

/** @param locale  for example 'en-IE' or 'el-GR' */
export function setMoneyLocale(locale: string): void {
  euroFormatter = new Intl.NumberFormat(locale, { style: 'currency', currency: 'EUR', maximumFractionDigits: 2 });
  percentFormatter = new Intl.NumberFormat(locale, {
    style: 'percent',
    minimumFractionDigits: 1,
    maximumFractionDigits: 1,
  });
}

/** 1234.5 -> "€1,234.50" (English) or "1.234,50 €" (Greek) */
export function formatEuros(amount: number): string {
  return euroFormatter.format(amount);
}

/** 0.523 -> "52.3%" (English) or "52,3%" (Greek) */
export function formatPercent(fraction: number): string {
  return percentFormatter.format(fraction);
}

/**
 * Parses a typed amount; returns null when it isn't one. Accepts "3,50" as well as "3.50",
 * and nothing else: "1e3", "-5" or "3.50abc" are null rather than 1000, -5 or 3.5.
 */
export function parseAmount(text: string | number): number | null {
  const typed = String(text).trim();
  if (!/^\d+([.,]\d+)?$/.test(typed)) return null;
  return Number(typed.replace(',', '.'));
}
