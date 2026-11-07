/** Edits to income, recorded like expenses (see expenses-api.ts). */
import { createUniqueId } from '../utils/ids.ts';
import { monthPageState } from '../sync/month-page-state.ts';

export interface NewIncome {
  amount: number;
  description: string;
  /** "YYYY-MM-DD" in the month */
  date: string;
}

/** POST /api/months/:month/income */
export function addIncome(monthKey: string, income: NewIncome): boolean {
  return monthPageState.recordEdit('addIncome', { month: monthKey }, { id: createUniqueId(), ...income });
}

/** PUT /api/months/:month/income/:id/amount */
export function changeIncomeAmount(monthKey: string, incomeId: string, amount: number): boolean {
  return monthPageState.recordEdit('changeIncomeAmount', { month: monthKey, id: incomeId }, { amount });
}

/** DELETE /api/months/:month/income/:id */
export function removeIncome(monthKey: string, incomeId: string): boolean {
  return monthPageState.recordEdit('removeIncome', { month: monthKey, id: incomeId }, undefined);
}

/** PUT /api/months/:month/expected-income */
export function changeExpectedIncome(monthKey: string, amount: number): boolean {
  return monthPageState.recordEdit('changeExpectedIncome', { month: monthKey }, { amount });
}
