const euroFormatter = new Intl.NumberFormat('en-IE', {
  style: 'currency',
  currency: 'EUR',
  maximumFractionDigits: 2,
});

/** 1234.5 -> "€1,234.50" */
export function formatEuros(amount) {
  return euroFormatter.format(amount);
}

/** Rounds to whole cents, avoiding values like 0.30000000000000004. */
export function roundToCents(amount) {
  return Math.round(amount * 100) / 100;
}

export function sumAmounts(amounts) {
  return amounts.reduce((total, amount) => total + amount, 0);
}

/** Parses an input value; returns null when it isn't a number. */
export function parseAmount(text) {
  const amount = Number.parseFloat(text);
  return Number.isFinite(amount) ? amount : null;
}
