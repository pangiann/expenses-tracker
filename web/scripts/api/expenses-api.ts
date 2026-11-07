/**
 * Edits to expenses: one function per endpoint. Each records its edit with
 * monthPageState.recordEdit() (sync/month-page-state.ts), which keeps it in the outbox to send
 * and shows it at once. A new expense gets its id here, so sending it twice can't add it
 * twice. Each returns false, and changes nothing, when the edit doesn't match its endpoint
 * (for example an amount of 0).
 */
import { createUniqueId } from '../utils/ids.ts';
import { monthPageState } from '../sync/month-page-state.ts';

export interface NewExpense {
  categoryId: string;
  amount: number;
  description: string;
  /** "YYYY-MM-DD" in the month */
  date: string;
}

/** POST /api/months/:month/expenses */
export function addExpense(monthKey: string, expense: NewExpense): boolean {
  return monthPageState.recordEdit('addExpense', { month: monthKey }, { id: createUniqueId(), ...expense });
}

/** PUT /api/months/:month/expenses/:id/amount */
export function changeExpenseAmount(monthKey: string, expenseId: string, amount: number): boolean {
  return monthPageState.recordEdit('changeExpenseAmount', { month: monthKey, id: expenseId }, { amount });
}

/** DELETE /api/months/:month/expenses/:id */
export function removeExpense(monthKey: string, expenseId: string): boolean {
  return monthPageState.recordEdit('removeExpense', { month: monthKey, id: expenseId }, undefined);
}
