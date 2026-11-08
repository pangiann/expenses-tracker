import type { EndpointName } from '../../../shared/api/endpoints.ts';
import {
  addExpenseOperation,
  addIncomeOperation,
  addCategoryOperation,
  addRecurringCostOperation,
} from './add-operations.ts';
import { exportMonthsOperation, importMonthsOperation } from './backup-operations.ts';
import {
  changeExpenseAmountOperation,
  changeIncomeAmountOperation,
  changeExpectedIncomeOperation,
  renameCategoryOperation,
  moveCategoryOperation,
  changeBudgetOperation,
  renameRecurringCostOperation,
  changeRecurringCostAmountOperation,
} from './change-operations.ts';
import { getMonthOperation, getYearSummaryOperation } from './read-operations.ts';
import {
  removeExpenseOperation,
  removeIncomeOperation,
  removeCategoryOperation,
  removeRecurringCostOperation,
} from './remove-operations.ts';
import type { Operation } from './operation.ts';

/**
 * The operation that answers each endpoint of shared/api/endpoints.ts. The router looks the
 * endpoint's name up here. TypeScript fails the build if an endpoint has no operation.
 */
export const operationRegistry: { [Name in EndpointName]: Operation<Name> } = {
  getMonth: getMonthOperation,
  getYearSummary: getYearSummaryOperation,
  exportMonths: exportMonthsOperation,
  importMonths: importMonthsOperation,
  addExpense: addExpenseOperation,
  changeExpenseAmount: changeExpenseAmountOperation,
  removeExpense: removeExpenseOperation,
  addIncome: addIncomeOperation,
  changeIncomeAmount: changeIncomeAmountOperation,
  removeIncome: removeIncomeOperation,
  changeExpectedIncome: changeExpectedIncomeOperation,
  addCategory: addCategoryOperation,
  renameCategory: renameCategoryOperation,
  moveCategory: moveCategoryOperation,
  changeBudget: changeBudgetOperation,
  removeCategory: removeCategoryOperation,
  addRecurringCost: addRecurringCostOperation,
  renameRecurringCost: renameRecurringCostOperation,
  changeRecurringCostAmount: changeRecurringCostAmountOperation,
  removeRecurringCost: removeRecurringCostOperation,
};
