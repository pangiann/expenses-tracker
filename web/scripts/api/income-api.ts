/** Edits to income, recorded like expenses (see expenses-api.ts). */
import type { IncomeEntry } from '../../../shared/month/month-record.ts';
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

/**
 * DELETE /api/months/:month/income/:id. The page then offers to undo it for a few seconds,
 * except for entries without a date (an income number from the old spreadsheet), which can't
 * be added again.
 */
export function removeIncome(monthKey: string, incomeId: string): boolean {
  const income = monthPageState.getSnapshot().month?.findIncome(incomeId);
  const wasEditRecorded = monthPageState.recordEdit('removeIncome', { month: monthKey, id: incomeId }, undefined);
  if (wasEditRecorded && income?.date) monthPageState.offerUndo({ kind: 'income', monthKey, income: { ...income } });
  return wasEditRecorded;
}

/**
 * Undo for removeIncome: POST /api/months/:month/income with the entry's own id, amount,
 * description and date, like restoreExpense in expenses-api.ts.
 */
export function restoreIncome(monthKey: string, income: IncomeEntry): boolean {
  monthPageState.dismissUndo();
  if (!income.date) return false;
  return monthPageState.recordEdit(
    'addIncome',
    { month: monthKey },
    { id: income.id, amount: income.amount, description: income.description, date: income.date },
  );
}

/** PUT /api/months/:month/expected-income */
export function changeExpectedIncome(monthKey: string, amount: number): boolean {
  return monthPageState.recordEdit('changeExpectedIncome', { month: monthKey }, { amount });
}
