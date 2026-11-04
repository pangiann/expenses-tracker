import { monthEditPerEndpoint } from '../../../shared/api/month-edit-per-endpoint.ts';
import { loadEditSaveAndBroadcastMonth } from '../load-edit-save-and-broadcast-month.ts';
import type { Operation } from './operation.ts';

/**
 * DELETE /api/months/:month/income/:id: removes an income entry.
 * The edit itself is monthEditPerEndpoint.removeIncome, which the page also runs to show the edit at once.
 */
export const removeIncomeOperation: Operation<'removeIncome'> = (request, context) =>
  loadEditSaveAndBroadcastMonth(context, request.params.month, (month) =>
    monthEditPerEndpoint.removeIncome(month, request),
  );
