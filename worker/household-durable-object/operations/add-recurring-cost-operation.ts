import { monthEditPerEndpoint } from '../../../shared/api/month-edit-per-endpoint.ts';
import { loadEditSaveAndBroadcastMonth } from '../load-edit-save-and-broadcast-month.ts';
import type { Operation } from './operation.ts';

/**
 * POST /api/months/:month/recurring/:list: adds a fixed cost or subscription.
 * The edit itself is monthEditPerEndpoint.addRecurringCost, which the page also runs to show the edit at once.
 */
export const addRecurringCostOperation: Operation<'addRecurringCost'> = (request, context) =>
  loadEditSaveAndBroadcastMonth(context, request.params.month, (month) =>
    monthEditPerEndpoint.addRecurringCost(month, request),
  );
