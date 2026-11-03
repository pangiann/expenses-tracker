/**
 * Checks for whole months arriving from outside (imports, stored files).
 * Shared by the browser and the Cloudflare server.
 */

export const MONTH_KEY_PATTERN = /^\d{4}-(0[1-9]|1[0-2])$/;

export function isValidMonthKey(monthKey: unknown): monthKey is string {
  return typeof monthKey === 'string' && MONTH_KEY_PATTERN.test(monthKey);
}

/** True when the data has the basic shape of a month file. */
export function isMonthData(monthData: unknown): monthData is { month: string; expenses: unknown[] } {
  return (
    monthData !== null &&
    typeof monthData === 'object' &&
    'month' in monthData &&
    isValidMonthKey(monthData.month) &&
    'expenses' in monthData &&
    Array.isArray(monthData.expenses)
  );
}

/**
 * The saved month to copy budgets and recurring costs from when creating monthKey:
 * the latest saved month before it, or else the earliest one after it.
 * @param savedMonthKeys  oldest first
 */
export function closestSavedMonthKey(savedMonthKeys: readonly string[], monthKey: string): string | null {
  const earlierMonthKeys = savedMonthKeys.filter((savedKey) => savedKey < monthKey);
  if (earlierMonthKeys.length > 0) return earlierMonthKeys.at(-1) ?? null;
  return savedMonthKeys.find((savedKey) => savedKey > monthKey) ?? null;
}
