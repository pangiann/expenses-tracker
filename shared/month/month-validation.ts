import type { MonthData } from './month-record.ts';

/**
 * Checks for whole months arriving from outside (imports, stored files).
 * Shared by the browser and the Cloudflare server.
 */

export const MONTH_KEY_PATTERN = /^\d{4}-(0[1-9]|1[0-2])$/;

export function isValidMonthKey(monthKey: unknown): monthKey is string {
  return typeof monthKey === 'string' && MONTH_KEY_PATTERN.test(monthKey);
}

/**
 * True when the data has every part of a month file in the current format: a month key, income
 * with a list of entries, a category list, budgets, expenses, and fixed costs and subscriptions
 * that all have ids. Files in an older format (one income number, no category list, fixed
 * costs without ids) are refused.
 */
export function isMonthData(monthData: unknown): monthData is MonthData {
  if (!isPlainObject(monthData) || !isValidMonthKey(monthData.month)) return false;
  const { income, categories, budgets, expenses, fixed, subscriptions } = monthData;
  return (
    isPlainObject(income) &&
    typeof income.expected === 'number' &&
    Array.isArray(income.entries) &&
    Array.isArray(categories) &&
    isPlainObject(budgets) &&
    Array.isArray(expenses) &&
    isListOfItemsWithIds(fixed) &&
    isListOfItemsWithIds(subscriptions)
  );
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function isListOfItemsWithIds(value: unknown): boolean {
  return Array.isArray(value) && value.every((item) => isPlainObject(item) && typeof item.id === 'string');
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
