import { monthEditPerEndpoint } from '../../../shared/api/month-edit-per-endpoint.ts';
import { loadEditSaveAndBroadcastMonth } from '../load-edit-save-and-broadcast-month.ts';
import type { Operation } from './operation.ts';

/**
 * DELETE /api/months/:month/expenses/:id: removes an expense.
 * The edit itself is monthEditPerEndpoint.removeExpense, which the page also runs to show the edit at once.
 */
export const removeExpenseOperation: Operation<'removeExpense'> = (request, context) =>
  loadEditSaveAndBroadcastMonth(context, request.params.month, (month) =>
    monthEditPerEndpoint.removeExpense(month, request),
  );
