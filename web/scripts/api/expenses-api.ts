/**
 * Edits to expenses. Each function sends one request through the outbox (outbox.ts), which
 * sends edits in order and shows the server's answer, the month after the edit. A new
 * expense gets its id here, so sending it twice can't add it twice. Each returns false, and
 * sends nothing, when the edit doesn't match its endpoint (for example an amount of 0).
 */
import { createUniqueId } from '../utils/ids.ts';
import { outbox } from './outbox.ts';

export interface NewExpense {
  categoryId: string;
  amount: number;
  description: string;
  /** "YYYY-MM-DD" in the month */
  date: string;
}

/** POST /api/months/:month/expenses */
export function addExpense(monthKey: string, expense: NewExpense): boolean {
  return outbox.send('addExpense', { month: monthKey }, { id: createUniqueId(), ...expense });
}

/** PUT /api/months/:month/expenses/:id/amount */
export function changeExpenseAmount(monthKey: string, expenseId: string, amount: number): boolean {
  return outbox.send('changeExpenseAmount', { month: monthKey, id: expenseId }, { amount });
}

/** DELETE /api/months/:month/expenses/:id */
export function removeExpense(monthKey: string, expenseId: string): boolean {
  return outbox.send('removeExpense', { month: monthKey, id: expenseId }, undefined);
}
