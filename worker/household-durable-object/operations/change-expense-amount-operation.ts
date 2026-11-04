import { monthEditPerEndpoint } from '../../../shared/api/month-edit-per-endpoint.ts';
import { loadEditSaveAndBroadcastMonth } from '../load-edit-save-and-broadcast-month.ts';
import type { Operation } from './operation.ts';

/**
 * PUT /api/months/:month/expenses/:id/amount: changes an expense's amount.
 * The edit itself is monthEditPerEndpoint.changeExpenseAmount, which the page also runs to show the edit at once.
 */
export const changeExpenseAmountOperation: Operation<'changeExpenseAmount'> = (request, context) =>
  loadEditSaveAndBroadcastMonth(context, request.params.month, (month) =>
    monthEditPerEndpoint.changeExpenseAmount(month, request),
  );
