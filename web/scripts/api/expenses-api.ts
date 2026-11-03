/**
 * Edits to expenses. Each function sends one request through the outbox (outbox.ts), which
 * sends edits in order and shows the server's answer, the month after the edit. A new
 * expense gets its id here, so sending it twice can't add it twice.
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
export function addExpense(monthKey: string, expense: NewExpense): void {
  outbox.send('addExpense', { month: monthKey }, { id: createUniqueId(), ...expense });
}

/** PUT /api/months/:month/expenses/:id/amount */
export function changeExpenseAmount(monthKey: string, expenseId: string, amount: number): void {
  outbox.send('changeExpenseAmount', { month: monthKey, id: expenseId }, { amount });
}

/** DELETE /api/months/:month/expenses/:id */
export function removeExpense(monthKey: string, expenseId: string): void {
  outbox.send('removeExpense', { month: monthKey, id: expenseId }, undefined);
}
