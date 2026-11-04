import type { Operation } from './operation.ts';

/** GET /api/export: every saved month of this household, for a backup file. */
export const exportMonthsOperation: Operation<'exportMonths'> = async (_request, context) => {
  return { months: await context.monthRepository.loadAllMonths() };
};
