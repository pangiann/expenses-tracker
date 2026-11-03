import { MonthRecord } from '../../../shared/month/month-record.ts';
import { isMonthData } from '../../../shared/month/month-validation.ts';
import { monthResponse } from '../household.ts';
import type { Handler } from './handler.ts';

const MAX_IMPORTED_MONTHS = 1200; // 100 years

export class InvalidImportError extends Error {}

/** GET /api/months/:month: the month, created from the closest saved month if missing. */
export const getMonth: Handler<'getMonth'> = async ({ params }, household) => {
  const month = await household.months.loadOrCreate(params.month);
  return monthResponse(household, month);
};

/** GET /api/export: every saved month, for a backup file. */
export const exportMonths: Handler<'exportMonths'> = async (_request, household) => {
  return { months: await household.months.allMonths() };
};

/** POST /api/import: saves the months in a backup file, replacing those with the same key. */
export const importMonths: Handler<'importMonths'> = async ({ body }, household) => {
  const { months } = body;
  if (months.length === 0 || months.length > MAX_IMPORTED_MONTHS || !months.every(isMonthData)) {
    throw new InvalidImportError('Not a valid list of months');
  }
  await household.months.saveAll(months.map((monthData) => new MonthRecord(monthData)));
  return { count: months.length };
};
