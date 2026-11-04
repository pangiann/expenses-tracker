import { monthEditPerEndpoint } from '../../../shared/api/month-edit-per-endpoint.ts';
import { loadEditSaveAndBroadcastMonth } from '../load-edit-save-and-broadcast-month.ts';
import type { Operation } from './operation.ts';

/**
 * DELETE /api/months/:month/recurring/:list/:id: removes a fixed cost or subscription.
 * The edit itself is monthEditPerEndpoint.removeRecurringCost, which the page also runs to show the edit at once.
 */
export const removeRecurringCostOperation: Operation<'removeRecurringCost'> = (request, context) =>
  loadEditSaveAndBroadcastMonth(context, request.params.month, (month) =>
    monthEditPerEndpoint.removeRecurringCost(month, request),
  );
