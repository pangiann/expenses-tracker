/** Amount helpers with no language, used by the page and the Worker. */

/** Rounds to whole cents, avoiding values like 0.30000000000000004. */
export function roundToCents(amount) {
  return Math.round(amount * 100) / 100;
}

export function sumAmounts(amounts) {
  return amounts.reduce((total, amount) => total + amount, 0);
}
