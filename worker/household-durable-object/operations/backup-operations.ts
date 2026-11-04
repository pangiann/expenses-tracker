/** The Export and Import buttons: every month of the household as one backup file. */
import { MonthRecord } from '../../../shared/month/month-record.ts';
import { isMonthData } from '../../../shared/month/month-validation.ts';
import type { Operation } from './operation.ts';

const MAX_IMPORTED_MONTHS = 1200; // 100 years

/** The backup file isn't a list of months; the router answers 400. */
export class InvalidImportError extends Error {}

/** GET /api/export: every saved month of this household, for a backup file. */
export const exportMonthsOperation: Operation<'exportMonths'> = async (_request, context) => {
  return { months: await context.monthRepository.loadAllMonths() };
};

/** POST /api/import: saves the months of a backup file, replacing those with the same month key. */
export const importMonthsOperation: Operation<'importMonths'> = async ({ body }, context) => {
  const { months } = body;
  if (months.length === 0 || months.length > MAX_IMPORTED_MONTHS || !months.every(isMonthData)) {
    throw new InvalidImportError('Not a valid list of months');
  }
  await context.monthRepository.saveMonths(months.map((monthData) => new MonthRecord(monthData)));
  return { count: months.length };
};
