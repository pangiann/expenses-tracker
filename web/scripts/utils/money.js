/**
 * Money helpers. Formatting follows the page language (set once at start by main.js):
 * English shows "€1,234.50", Greek shows "1.234,50 €".
 * The rounding and sum helpers have no language and also run in the Cloudflare Worker.
 */

let euroFormatter = new Intl.NumberFormat('en-IE', { style: 'currency', currency: 'EUR', maximumFractionDigits: 2 });
let percentFormatter = new Intl.NumberFormat('en-IE', { style: 'percent', minimumFractionDigits: 1, maximumFractionDigits: 1 });

/** @param {string} locale  for example 'en-IE' or 'el-GR' */
export function setMoneyLocale(locale) {
  euroFormatter = new Intl.NumberFormat(locale, { style: 'currency', currency: 'EUR', maximumFractionDigits: 2 });
  percentFormatter = new Intl.NumberFormat(locale, { style: 'percent', minimumFractionDigits: 1, maximumFractionDigits: 1 });
}

/** 1234.5 -> "€1,234.50" (English) or "1.234,50 €" (Greek) */
export function formatEuros(amount) {
  return euroFormatter.format(amount);
}

/** 0.523 -> "52.3%" (English) or "52,3%" (Greek) */
export function formatPercent(fraction) {
  return percentFormatter.format(fraction);
}

/** Rounds to whole cents, avoiding values like 0.30000000000000004. */
export function roundToCents(amount) {
  return Math.round(amount * 100) / 100;
}

export function sumAmounts(amounts) {
  return amounts.reduce((total, amount) => total + amount, 0);
}

/** Parses an input value; returns null when it isn't a number. Accepts "3,50" as well as "3.50". */
export function parseAmount(text) {
  const amount = Number.parseFloat(String(text).replace(',', '.'));
  return Number.isFinite(amount) ? amount : null;
}
