import { monthEditPerEndpoint } from '../../../shared/api/month-edit-per-endpoint.ts';
import { loadEditSaveAndBroadcastMonth } from '../load-edit-save-and-broadcast-month.ts';
import type { Operation } from './operation.ts';

/**
 * POST /api/months/:month/categories: adds a category at the end, with a budget of 0.
 * The edit itself is monthEditPerEndpoint.addCategory, which the page also runs to show the edit at once.
 */
export const addCategoryOperation: Operation<'addCategory'> = (request, context) =>
  loadEditSaveAndBroadcastMonth(context, request.params.month, (month) =>
    monthEditPerEndpoint.addCategory(month, request),
  );
