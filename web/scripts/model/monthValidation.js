/**
 * Checks for whole months arriving from outside (imports, stored files).
 * Shared by the browser and the Cloudflare server.
 */

export const MONTH_KEY_PATTERN = /^\d{4}-(0[1-9]|1[0-2])$/;

export function isValidMonthKey(monthKey) {
  return typeof monthKey === 'string' && MONTH_KEY_PATTERN.test(monthKey);
}

/** True when the data has the basic shape of a month file. */
export function isMonthData(monthData) {
  return monthData !== null
    && typeof monthData === 'object'
    && isValidMonthKey(monthData.month)
    && Array.isArray(monthData.expenses);
}

/**
 * The saved month to copy budgets and recurring costs from when creating monthKey:
 * the latest saved month before it, or else the earliest one after it.
 * @param {string[]} savedMonthKeys  oldest first
 * @returns {string | null}
 */
export function closestSavedMonthKey(savedMonthKeys, monthKey) {
  const earlierMonthKeys = savedMonthKeys.filter((savedKey) => savedKey < monthKey);
  if (earlierMonthKeys.length > 0) return earlierMonthKeys[earlierMonthKeys.length - 1];
  return savedMonthKeys.find((savedKey) => savedKey > monthKey) ?? null;
}
