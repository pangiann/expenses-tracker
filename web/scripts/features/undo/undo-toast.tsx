import { useEffect } from 'react';

import type { Expense } from '../../../../shared/month/month-record.ts';
import * as expensesApi from '../../api/expenses-api.ts';
import { t } from '../../i18n/translator.ts';
import { formatEuros } from '../../utils/money.ts';

/** How long the toast offers the undo. */
export const UNDO_TIME_MS = 6_000;

interface UndoToastProps {
  /** The expense just removed and its month; null hides the toast. */
  removedExpense: { monthKey: string; expense: Expense } | null;
  /** The time ran out or the undo was used: stop offering it. */
  onDismiss: () => void;
}

/**
 * "Expense removed · Undo" at the bottom of the screen for a few seconds after an expense is
 * removed. Undo adds the same expense back, with its own id (expensesApi.restoreExpense), so it
 * also works offline and on another month than the one on screen.
 */
export function UndoToast({ removedExpense, onDismiss }: UndoToastProps) {
  const expenseId = removedExpense?.expense.id;
  // A new removal starts the time again.
  useEffect(() => {
    if (!expenseId) return;
    const timer = setTimeout(onDismiss, UNDO_TIME_MS);
    return () => clearTimeout(timer);
  }, [expenseId, onDismiss]);

  if (!removedExpense) return null;
  const { monthKey, expense } = removedExpense;
  return (
    <div className="undo-toast" role="status">
      <span className="undo-toast-text">{t('undo.expenseRemoved', { amount: formatEuros(expense.amount) })}</span>
      <button className="undo-toast-button" onClick={() => expensesApi.restoreExpense(monthKey, expense)}>
        {t('undo.undo')}
      </button>
    </div>
  );
}
