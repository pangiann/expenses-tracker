import { monthEditPerEndpoint } from '../../../shared/api/month-edit-per-endpoint.ts';
import { loadEditSaveAndBroadcastMonth } from '../load-edit-save-and-broadcast-month.ts';
import type { Operation } from './operation.ts';

/**
 * PUT /api/months/:month/income/:id/amount: changes an income entry's amount.
 * The edit itself is monthEditPerEndpoint.changeIncomeAmount, which the page also runs to show the edit at once.
 */
export const changeIncomeAmountOperation: Operation<'changeIncomeAmount'> = (request, context) =>
  loadEditSaveAndBroadcastMonth(context, request.params.month, (month) =>
    monthEditPerEndpoint.changeIncomeAmount(month, request),
  );
