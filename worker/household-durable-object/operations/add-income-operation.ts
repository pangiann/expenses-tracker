import { monthEditPerEndpoint } from '../../../shared/api/month-edit-per-endpoint.ts';
import { loadEditSaveAndBroadcastMonth } from '../load-edit-save-and-broadcast-month.ts';
import type { Operation } from './operation.ts';

/**
 * POST /api/months/:month/income: adds an income entry.
 * The edit itself is monthEditPerEndpoint.addIncome, which the page also runs to show the edit at once.
 */
export const addIncomeOperation: Operation<'addIncome'> = (request, context) =>
  loadEditSaveAndBroadcastMonth(context, request.params.month, (month) =>
    monthEditPerEndpoint.addIncome(month, request),
  );
