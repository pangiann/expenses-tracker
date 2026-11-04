import { monthEditPerEndpoint } from '../../../shared/api/month-edit-per-endpoint.ts';
import { loadEditSaveAndBroadcastMonth } from '../load-edit-save-and-broadcast-month.ts';
import type { Operation } from './operation.ts';

/**
 * PUT /api/months/:month/categories/:id/position: moves a category before another one, or to the end.
 * The edit itself is monthEditPerEndpoint.moveCategory, which the page also runs to show the edit at once.
 */
export const moveCategoryOperation: Operation<'moveCategory'> = (request, context) =>
  loadEditSaveAndBroadcastMonth(context, request.params.month, (month) =>
    monthEditPerEndpoint.moveCategory(month, request),
  );
