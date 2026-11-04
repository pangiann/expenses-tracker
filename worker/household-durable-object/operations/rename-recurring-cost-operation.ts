import { monthEditPerEndpoint } from '../../../shared/api/month-edit-per-endpoint.ts';
import { loadEditSaveAndBroadcastMonth } from '../load-edit-save-and-broadcast-month.ts';
import type { Operation } from './operation.ts';

/**
 * PUT /api/months/:month/recurring/:list/:id/name: renames a fixed cost or subscription.
 * The edit itself is monthEditPerEndpoint.renameRecurringCost, which the page also runs to show the edit at once.
 */
export const renameRecurringCostOperation: Operation<'renameRecurringCost'> = (request, context) =>
  loadEditSaveAndBroadcastMonth(context, request.params.month, (month) =>
    monthEditPerEndpoint.renameRecurringCost(month, request),
  );
