import type { EndpointName } from '../../../shared/api/endpoints.ts';
import type { Handler } from './handler.ts';
import { monthEditHandler } from './month-edit.ts';
import { exportMonths, getMonth, importMonths } from './months.ts';

/**
 * The handler for each endpoint. TypeScript fails the build if an endpoint has none.
 * Edits all work the same way (month-edit.ts); what each one changes is in
 * shared/api/month-edits.ts.
 */
export const handlers: { [Name in EndpointName]: Handler<Name> } = {
  getMonth,
  exportMonths,
  importMonths,

  addExpense: monthEditHandler('addExpense'),
  changeExpenseAmount: monthEditHandler('changeExpenseAmount'),
  removeExpense: monthEditHandler('removeExpense'),

  addIncome: monthEditHandler('addIncome'),
  changeIncomeAmount: monthEditHandler('changeIncomeAmount'),
  removeIncome: monthEditHandler('removeIncome'),
  changeExpectedIncome: monthEditHandler('changeExpectedIncome'),

  addCategory: monthEditHandler('addCategory'),
  renameCategory: monthEditHandler('renameCategory'),
  moveCategory: monthEditHandler('moveCategory'),
  changeBudget: monthEditHandler('changeBudget'),
  removeCategory: monthEditHandler('removeCategory'),

  addRecurringCost: monthEditHandler('addRecurringCost'),
  renameRecurringCost: monthEditHandler('renameRecurringCost'),
  changeRecurringCostAmount: monthEditHandler('changeRecurringCostAmount'),
  removeRecurringCost: monthEditHandler('removeRecurringCost'),
};
