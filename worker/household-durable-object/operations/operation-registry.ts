import type { EndpointName } from '../../../shared/api/endpoints.ts';
import { addCategoryOperation } from './add-category-operation.ts';
import { addExpenseOperation } from './add-expense-operation.ts';
import { addIncomeOperation } from './add-income-operation.ts';
import { addRecurringCostOperation } from './add-recurring-cost-operation.ts';
import { changeBudgetOperation } from './change-budget-operation.ts';
import { changeExpectedIncomeOperation } from './change-expected-income-operation.ts';
import { changeExpenseAmountOperation } from './change-expense-amount-operation.ts';
import { changeIncomeAmountOperation } from './change-income-amount-operation.ts';
import { changeRecurringCostAmountOperation } from './change-recurring-cost-amount-operation.ts';
import { exportMonthsOperation } from './export-months-operation.ts';
import { getMonthOperation } from './get-month-operation.ts';
import { importMonthsOperation } from './import-months-operation.ts';
import { moveCategoryOperation } from './move-category-operation.ts';
import { removeCategoryOperation } from './remove-category-operation.ts';
import { removeExpenseOperation } from './remove-expense-operation.ts';
import { removeIncomeOperation } from './remove-income-operation.ts';
import { removeRecurringCostOperation } from './remove-recurring-cost-operation.ts';
import { renameCategoryOperation } from './rename-category-operation.ts';
import { renameRecurringCostOperation } from './rename-recurring-cost-operation.ts';
import type { Operation } from './operation.ts';

/**
 * The operation that answers each endpoint of shared/api/endpoints.ts. The router looks the
 * endpoint's name up here. TypeScript fails the build if an endpoint has no operation.
 */
export const operationRegistry: { [Name in EndpointName]: Operation<Name> } = {
  getMonth: getMonthOperation,
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
