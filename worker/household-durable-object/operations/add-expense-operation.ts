import { monthEditPerEndpoint } from '../../../shared/api/month-edit-per-endpoint.ts';
import { loadEditSaveAndBroadcastMonth } from '../load-edit-save-and-broadcast-month.ts';
import type { Operation } from './operation.ts';

/**
 * POST /api/months/:month/expenses: adds an expense.
 * The edit itself is monthEditPerEndpoint.addExpense, which the page also runs to show the edit at once.
 */
export const addExpenseOperation: Operation<'addExpense'> = (request, context) =>
  loadEditSaveAndBroadcastMonth(context, request.params.month, (month) =>
    monthEditPerEndpoint.addExpense(month, request),
  );
