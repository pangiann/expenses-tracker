/**
 * Operations that change an item already in a month: amounts, names, budgets, the order of categories.
 *
 * Every one follows the same steps (load-edit-save-and-broadcast-month.ts). What the edit
 * does to the month is in shared/month/apply-edit-to-month.ts, which the page also runs to
 * show the edit at once.
 */
import { editsByEndpoint } from '../../../shared/month/apply-edit-to-month.ts';
import { loadEditSaveAndBroadcastMonth } from '../load-edit-save-and-broadcast-month.ts';
import type { Operation } from './operation.ts';

/** PUT /api/months/:month/expenses/:id/amount: changes an expense's amount. */
export const changeExpenseAmountOperation: Operation<'changeExpenseAmount'> = (request, context) =>
  loadEditSaveAndBroadcastMonth(context, request.params.month, (month) =>
    editsByEndpoint.changeExpenseAmount(month, request),
  );

/** PUT /api/months/:month/income/:id/amount: changes an income entry's amount. */
export const changeIncomeAmountOperation: Operation<'changeIncomeAmount'> = (request, context) =>
  loadEditSaveAndBroadcastMonth(context, request.params.month, (month) =>
    editsByEndpoint.changeIncomeAmount(month, request),
  );

/** PUT /api/months/:month/expected-income: sets the expected income. */
export const changeExpectedIncomeOperation: Operation<'changeExpectedIncome'> = (request, context) =>
  loadEditSaveAndBroadcastMonth(context, request.params.month, (month) =>
    editsByEndpoint.changeExpectedIncome(month, request),
  );

/** PUT /api/months/:month/categories/:id/name: renames a category. */
export const renameCategoryOperation: Operation<'renameCategory'> = (request, context) =>
  loadEditSaveAndBroadcastMonth(context, request.params.month, (month) =>
    editsByEndpoint.renameCategory(month, request),
  );

/** PUT /api/months/:month/categories/:id/position: moves a category before another one, or to the end. */
export const moveCategoryOperation: Operation<'moveCategory'> = (request, context) =>
  loadEditSaveAndBroadcastMonth(context, request.params.month, (month) => editsByEndpoint.moveCategory(month, request));

/** PUT /api/months/:month/categories/:id/budget: sets a category's budget. */
export const changeBudgetOperation: Operation<'changeBudget'> = (request, context) =>
  loadEditSaveAndBroadcastMonth(context, request.params.month, (month) => editsByEndpoint.changeBudget(month, request));

/** PUT /api/months/:month/recurring/:list/:id/name: renames a fixed cost or subscription. */
export const renameRecurringCostOperation: Operation<'renameRecurringCost'> = (request, context) =>
  loadEditSaveAndBroadcastMonth(context, request.params.month, (month) =>
    editsByEndpoint.renameRecurringCost(month, request),
  );

/** PUT /api/months/:month/recurring/:list/:id/amount: sets a fixed cost's or subscription's amount. */
export const changeRecurringCostAmountOperation: Operation<'changeRecurringCostAmount'> = (request, context) =>
  loadEditSaveAndBroadcastMonth(context, request.params.month, (month) =>
    editsByEndpoint.changeRecurringCostAmount(month, request),
  );
