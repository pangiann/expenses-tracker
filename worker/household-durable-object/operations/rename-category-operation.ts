import { monthEditPerEndpoint } from '../../../shared/api/month-edit-per-endpoint.ts';
import { loadEditSaveAndBroadcastMonth } from '../load-edit-save-and-broadcast-month.ts';
import type { Operation } from './operation.ts';

/**
 * PUT /api/months/:month/categories/:id/name: renames a category.
 * The edit itself is monthEditPerEndpoint.renameCategory, which the page also runs to show the edit at once.
 */
export const renameCategoryOperation: Operation<'renameCategory'> = (request, context) =>
  loadEditSaveAndBroadcastMonth(context, request.params.month, (month) =>
    monthEditPerEndpoint.renameCategory(month, request),
  );
