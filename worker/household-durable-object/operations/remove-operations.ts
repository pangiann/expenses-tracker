/**
 * Operations that remove an item from a month. Removing something already gone changes nothing.
 *
 * Every one follows the same steps (load-edit-save-and-broadcast-month.ts). What the edit
 * does to the month is in shared/month/apply-edit-to-month.ts, which the page also runs to
 * show the edit at once.
 */
import { editsByEndpoint } from '../../../shared/month/apply-edit-to-month.ts';
import { loadEditSaveAndBroadcastMonth } from '../load-edit-save-and-broadcast-month.ts';
import type { Operation } from './operation.ts';

/** DELETE /api/months/:month/expenses/:id: removes an expense. */
export const removeExpenseOperation: Operation<'removeExpense'> = (request, context) =>
  loadEditSaveAndBroadcastMonth(context, request.params.month, (month) =>
    editsByEndpoint.removeExpense(month, request),
  );

/** DELETE /api/months/:month/income/:id: removes an income entry. */
export const removeIncomeOperation: Operation<'removeIncome'> = (request, context) =>
  loadEditSaveAndBroadcastMonth(context, request.params.month, (month) => editsByEndpoint.removeIncome(month, request));

/** DELETE /api/months/:month/categories/:id: removes an empty category. */
export const removeCategoryOperation: Operation<'removeCategory'> = (request, context) =>
  loadEditSaveAndBroadcastMonth(context, request.params.month, (month) =>
    editsByEndpoint.removeCategory(month, request),
  );

/** DELETE /api/months/:month/recurring/:list/:id: removes a fixed cost or subscription. */
export const removeRecurringCostOperation: Operation<'removeRecurringCost'> = (request, context) =>
  loadEditSaveAndBroadcastMonth(context, request.params.month, (month) =>
    editsByEndpoint.removeRecurringCost(month, request),
  );
