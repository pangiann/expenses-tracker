/** Edits to income, sent through the outbox like expenses (see expenses-api.ts). */
import { createUniqueId } from '../utils/ids.ts';
import { pendingEditsOutbox } from './pending-edits-outbox.ts';

export interface NewIncome {
  amount: number;
  description: string;
  /** "YYYY-MM-DD" in the month */
  date: string;
}

/** POST /api/months/:month/income */
export function addIncome(monthKey: string, income: NewIncome): boolean {
  return pendingEditsOutbox.send('addIncome', { month: monthKey }, { id: createUniqueId(), ...income });
}

/** PUT /api/months/:month/income/:id/amount */
export function changeIncomeAmount(monthKey: string, incomeId: string, amount: number): boolean {
  return pendingEditsOutbox.send('changeIncomeAmount', { month: monthKey, id: incomeId }, { amount });
}

/** DELETE /api/months/:month/income/:id */
export function removeIncome(monthKey: string, incomeId: string): boolean {
  return pendingEditsOutbox.send('removeIncome', { month: monthKey, id: incomeId }, undefined);
}

/** PUT /api/months/:month/expected-income */
export function changeExpectedIncome(monthKey: string, amount: number): boolean {
  return pendingEditsOutbox.send('changeExpectedIncome', { month: monthKey }, { amount });
}
