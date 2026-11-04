import { monthEditPerEndpoint } from '../../../shared/api/month-edit-per-endpoint.ts';
import { loadEditSaveAndBroadcastMonth } from '../load-edit-save-and-broadcast-month.ts';
import type { Operation } from './operation.ts';

/**
 * PUT /api/months/:month/categories/:id/budget: sets a category's budget.
 * The edit itself is monthEditPerEndpoint.changeBudget, which the page also runs to show the edit at once.
 */
export const changeBudgetOperation: Operation<'changeBudget'> = (request, context) =>
  loadEditSaveAndBroadcastMonth(context, request.params.month, (month) =>
    monthEditPerEndpoint.changeBudget(month, request),
  );
