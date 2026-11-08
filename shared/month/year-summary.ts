import type { Category } from './categories.ts';
import type { MonthRecord } from './month-record.ts';

/** One saved month of the year, in totals: what the reports page draws. */
export interface MonthSummary {
  /** "YYYY-MM" */
  month: string;
  earned: number;
  /** variable spending plus fixed costs and subscriptions */
  spent: number;
  /** the expenses alone, without fixed costs and subscriptions */
  variableSpending: number;
  recurringCostsTotal: number;
  budgeted: number;
  saved: number;
  /** variable spending per category id; categories with nothing spent are left out */
  spentPerCategory: Record<string, number>;
}

/** The answer of GET /api/years/:year/summary. */
export interface YearSummary {
  year: number;
  /** the year's saved months, oldest first; months nobody opened are missing */
  months: MonthSummary[];
  /**
   * Every category that appears in the year, for names and order: the latest month's list,
   * followed by categories only earlier months had (for example one removed in June).
   */
  categories: Category[];
  /** every year that has a saved month, oldest first, for moving between years */
  savedYears: number[];
}

/** Sums up one month. */
export function summarizeMonth(month: MonthRecord): MonthSummary {
  const totals = month.calculateTotals();
  const spentPerCategory: Record<string, number> = {};
  for (const category of month.categories) {
    const spent = month.spentInCategory(category.id);
    if (spent > 0) spentPerCategory[category.id] = spent;
  }
  return {
    month: month.monthKey,
    earned: month.totalIncome,
    spent: totals.totalSpent,
    variableSpending: totals.variableSpending,
    recurringCostsTotal: totals.recurringCostsTotal,
    budgeted: totals.totalBudgeted,
    saved: totals.saved,
    spentPerCategory,
  };
}

/**
 * Sums up a year from its saved months.
 * @param monthsOfYear  the saved months of that year, in any order
 * @param savedMonthKeys  every saved month key of the household, for the list of years
 */
export function summarizeYear(year: number, monthsOfYear: MonthRecord[], savedMonthKeys: string[]): YearSummary {
  const oldestFirst = [...monthsOfYear].sort((first, second) => first.monthKey.localeCompare(second.monthKey));
  const categories: Category[] = [];
  const seenCategoryIds = new Set<string>();
  for (const month of [...oldestFirst].reverse()) {
    for (const category of month.categories) {
      if (seenCategoryIds.has(category.id)) continue;
      seenCategoryIds.add(category.id);
      categories.push({ ...category });
    }
  }
  const savedYears = [...new Set(savedMonthKeys.map((monthKey) => Number(monthKey.slice(0, 4))))].sort();
  return { year, months: oldestFirst.map(summarizeMonth), categories, savedYears };
}
