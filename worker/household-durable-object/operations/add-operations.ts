/**
 * Operations that add an item to a month. Each item gets its id on the page, so adding the same id twice adds it once.
 *
 * Every one follows the same steps (load-edit-save-and-broadcast-month.ts). What the edit
 * does to the month is in shared/api/month-edit-per-endpoint.ts, which the page also runs to
 * show the edit at once.
 */
import { monthEditPerEndpoint } from '../../../shared/api/month-edit-per-endpoint.ts';
import { loadEditSaveAndBroadcastMonth } from '../load-edit-save-and-broadcast-month.ts';
import type { Operation } from './operation.ts';

/** POST /api/months/:month/expenses: adds an expense. */
export const addExpenseOperation: Operation<'addExpense'> = (request, context) =>
  loadEditSaveAndBroadcastMonth(context, request.params.month, (month) =>
    monthEditPerEndpoint.addExpense(month, request),
  );

/** POST /api/months/:month/income: adds an income entry. */
export const addIncomeOperation: Operation<'addIncome'> = (request, context) =>
  loadEditSaveAndBroadcastMonth(context, request.params.month, (month) =>
    monthEditPerEndpoint.addIncome(month, request),
  );

/** POST /api/months/:month/categories: adds a category at the end, with a budget of 0. */
export const addCategoryOperation: Operation<'addCategory'> = (request, context) =>
  loadEditSaveAndBroadcastMonth(context, request.params.month, (month) =>
    monthEditPerEndpoint.addCategory(month, request),
  );

/** POST /api/months/:month/recurring/:list: adds a fixed cost or subscription. */
export const addRecurringCostOperation: Operation<'addRecurringCost'> = (request, context) =>
  loadEditSaveAndBroadcastMonth(context, request.params.month, (month) =>
    monthEditPerEndpoint.addRecurringCost(month, request),
  );
