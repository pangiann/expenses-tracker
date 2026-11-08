/** The sums the reports page shows, worked out from a year summary. Pure functions, unit-tested. */
import type { MonthSummary, YearSummary } from '../../../../shared/month/year-summary.ts';
import { sumAmounts } from '../../../../shared/month/amounts.ts';
import { monthDateRange, todayAsIsoDate } from '../../utils/month-keys.ts';

export interface YearTotals {
  earned: number;
  spent: number;
  saved: number;
  /** variable spending per day counted; 0 when no days are counted yet */
  dailyAverage: number;
  /** the days of the saved months that count for averages (see daysCountedIn) */
  daysCounted: number;
}

/**
 * How many days of the month count for averages: all of a past month, the days so far of the
 * current month (today included), none of a future month.
 */
export function daysCountedIn(monthKey: string, today = todayAsIsoDate()): number {
  const { firstDay, lastDay } = monthDateRange(monthKey);
  if (today < firstDay) return 0;
  const lastCountedDay = today < lastDay ? today : lastDay;
  return Number(lastCountedDay.slice(8, 10));
}

export function yearTotals(summary: YearSummary, today = todayAsIsoDate()): YearTotals {
  const daysCounted = summary.months.reduce((days, month) => days + daysCountedIn(month.month, today), 0);
  const variableSpending = sumAmounts(summary.months.map((month) => month.variableSpending));
  const earned = sumAmounts(summary.months.map((month) => month.earned));
  const spent = sumAmounts(summary.months.map((month) => month.spent));
  return {
    earned,
    spent,
    saved: earned - spent,
    dailyAverage: daysCounted > 0 ? variableSpending / daysCounted : 0,
    daysCounted,
  };
}

/** The daily average of one month's variable spending, or null for a month not started yet. */
export function monthDailyAverage(month: MonthSummary, today = todayAsIsoDate()): number | null {
  const days = daysCountedIn(month.month, today);
  return days > 0 ? month.variableSpending / days : null;
}

export interface CategoryTotal {
  categoryId: string;
  spent: number;
  /** spent / the year's variable spending, from 0 to 1 */
  share: number;
}

/** Each category's variable spending in the year, largest first; categories with none are left out. */
export function categoryTotals(summary: YearSummary): CategoryTotal[] {
  const spentPerCategory = new Map<string, number>();
  for (const month of summary.months) {
    for (const [categoryId, spent] of Object.entries(month.spentPerCategory)) {
      spentPerCategory.set(categoryId, sumAmounts([spentPerCategory.get(categoryId) ?? 0, spent]));
    }
  }
  const total = sumAmounts([...spentPerCategory.values()]);
  return [...spentPerCategory.entries()]
    .map(([categoryId, spent]) => ({ categoryId, spent, share: total > 0 ? spent / total : 0 }))
    .sort((first, second) => second.spent - first.spent);
}
