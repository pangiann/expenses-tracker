/**
 * Edits to expenses: one function per endpoint. Each records its edit with
 * monthPageState.recordEdit() (sync/month-page-state.ts), which keeps it in the outbox to send
 * and shows it at once. A new expense gets its id here, so sending it twice can't add it
 * twice. Each returns false, and changes nothing, when the edit doesn't match its endpoint
 * (for example an amount of 0).
 */
import type { Expense } from '../../../shared/month/month-record.ts';
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

/**
 * DELETE /api/months/:month/expenses/:id. The page then offers to undo it for a few seconds,
 * except for expenses without a date (some imported from the old spreadsheet), which can't
 * be added again.
 */
export function removeExpense(monthKey: string, expenseId: string): boolean {
  const expense = monthPageState.getSnapshot().month?.findExpense(expenseId);
  const wasEditRecorded = monthPageState.recordEdit('removeExpense', { month: monthKey, id: expenseId }, undefined);
  if (wasEditRecorded && expense?.date)
    monthPageState.offerUndo({ kind: 'expense', monthKey, expense: { ...expense } });
  return wasEditRecorded;
}

/**
 * Undo for removeExpense: POST /api/months/:month/expenses with the expense's own id, amount,
 * description and date. Adding an id the month doesn't have adds it back; if the server never
 * received the removal, the expense is still there and adding its id again changes nothing.
 */
export function restoreExpense(monthKey: string, expense: Expense): boolean {
  monthPageState.dismissUndo();
  if (!expense.date) return false;
  return monthPageState.recordEdit(
    'addExpense',
    { month: monthKey },
    {
      id: expense.id,
      categoryId: expense.category,
      amount: expense.amount,
      description: expense.description,
      date: expense.date,
    },
  );
}
