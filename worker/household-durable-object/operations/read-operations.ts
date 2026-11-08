/** Operations that only read: they change nothing and broadcast nothing. */
import { MonthRecord } from '../../../shared/month/month-record.ts';
import { summarizeYear } from '../../../shared/month/year-summary.ts';
import { buildMonthResponse } from '../operation-context.ts';
import type { Operation } from './operation.ts';

/** GET /api/months/:month: the month, created from the closest saved month if it doesn't exist yet. */
export const getMonthOperation: Operation<'getMonth'> = async ({ params }, context) => {
  const month = await context.monthRepository.loadMonthOrCreateFromClosestMonth(params.month);
  return buildMonthResponse(context, month);
};

/**
 * GET /api/years/:year/summary: the year's saved months in totals. Unlike getMonth, it creates
 * nothing: a year without saved months answers with an empty list.
 */
export const getYearSummaryOperation: Operation<'getYearSummary'> = async ({ params }, context) => {
  const allMonths = await context.monthRepository.loadAllMonths();
  const monthsOfYear = allMonths
    .filter((monthData) => monthData.month.startsWith(`${params.year}-`))
    .map((monthData) => new MonthRecord(monthData));
  return summarizeYear(Number(params.year), monthsOfYear, await context.monthRepository.savedMonthKeys());
};
