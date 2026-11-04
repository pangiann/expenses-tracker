import { monthEditPerEndpoint } from '../../../shared/api/month-edit-per-endpoint.ts';
import { loadEditSaveAndBroadcastMonth } from '../load-edit-save-and-broadcast-month.ts';
import type { Operation } from './operation.ts';

/**
 * PUT /api/months/:month/recurring/:list/:id/amount: sets a fixed cost's or subscription's amount.
 * The edit itself is monthEditPerEndpoint.changeRecurringCostAmount, which the page also runs to show the edit at once.
 */
export const changeRecurringCostAmountOperation: Operation<'changeRecurringCostAmount'> = (request, context) =>
  loadEditSaveAndBroadcastMonth(context, request.params.month, (month) =>
    monthEditPerEndpoint.changeRecurringCostAmount(month, request),
  );
