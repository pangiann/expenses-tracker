import type { EndpointName } from '../../../shared/api/endpoints.ts';
import { addCategory, changeBudget, moveCategory, removeCategory, renameCategory } from './categories.ts';
import { addExpense, changeExpenseAmount, removeExpense } from './expenses.ts';
import type { Handler } from './handler.ts';
import { addIncome, changeExpectedIncome, changeIncomeAmount, removeIncome } from './income.ts';
import { exportMonths, getMonth, importMonths } from './months.ts';
import {
  addRecurringCost,
  changeRecurringCostAmount,
  removeRecurringCost,
  renameRecurringCost,
} from './recurring-costs.ts';

/** The handler for each endpoint. TypeScript fails the build if an endpoint has none. */
export const handlers: { [Name in EndpointName]: Handler<Name> } = {
  getMonth,
  exportMonths,
  importMonths,
  addExpense,
  changeExpenseAmount,
  removeExpense,
  addIncome,
  changeIncomeAmount,
  removeIncome,
  changeExpectedIncome,
  addCategory,
  renameCategory,
  moveCategory,
  changeBudget,
  removeCategory,
  addRecurringCost,
  renameRecurringCost,
  changeRecurringCostAmount,
  removeRecurringCost,
};
