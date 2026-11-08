import { useEffect } from 'react';

import type { RecurringCostListName } from '../../../../shared/month/categories.ts';
import type { Expense, IncomeEntry, RecurringCost } from '../../../../shared/month/month-record.ts';
import * as expensesApi from '../../api/expenses-api.ts';
import * as incomeApi from '../../api/income-api.ts';
import * as recurringCostsApi from '../../api/recurring-costs-api.ts';
import { t } from '../../i18n/translator.ts';
import { formatEuros } from '../../utils/money.ts';

/** How long the toast offers the undo. */
export const UNDO_TIME_MS = 6_000;

/** What was removed: an expense, an income entry, or a fixed cost or subscription. */
export type UndoableRemoval =
  | { kind: 'expense'; monthKey: string; expense: Expense }
  | { kind: 'income'; monthKey: string; income: IncomeEntry }
  | { kind: 'recurringCost'; monthKey: string; list: RecurringCostListName; cost: RecurringCost };

interface UndoToastProps {
  /** The item just removed and its month; null hides the toast. */
  removedItem: UndoableRemoval | null;
  /** The time ran out or the undo was used: stop offering it. */
  onDismiss: () => void;
}

/**
 * "Expense removed · Undo" (or "Rent removed · Undo") at the bottom of the screen for a few
 * seconds after a removal. Undo adds the same item back, with its own id, so it also works
 * offline and on another month than the one on screen.
 */
export function UndoToast({ removedItem, onDismiss }: UndoToastProps) {
  const removedId = removedItem && removedItemId(removedItem);
  // A new removal starts the time again.
  useEffect(() => {
    if (!removedId) return;
    const timer = setTimeout(onDismiss, UNDO_TIME_MS);
    return () => clearTimeout(timer);
  }, [removedId, onDismiss]);

  if (!removedItem) return null;
  const text = removalText(removedItem);
  const undo = () => restoreRemovedItem(removedItem);
  return (
    <div className="undo-toast" role="status">
      <span className="undo-toast-text">{text}</span>
      <button className="undo-toast-button" onClick={undo}>
        {t('undo.undo')}
      </button>
    </div>
  );
}

function removedItemId(removedItem: UndoableRemoval): string {
  if (removedItem.kind === 'expense') return removedItem.expense.id;
  if (removedItem.kind === 'income') return removedItem.income.id;
  return removedItem.cost.id;
}

function removalText(removedItem: UndoableRemoval): string {
  if (removedItem.kind === 'expense')
    return t('undo.expenseRemoved', { amount: formatEuros(removedItem.expense.amount) });
  if (removedItem.kind === 'income') return t('undo.incomeRemoved', { amount: formatEuros(removedItem.income.amount) });
  return t('undo.recurringCostRemoved', { name: removedItem.cost.name });
}

/** Adds the removed item back, with its own id (see the restore functions in api/). */
function restoreRemovedItem(removedItem: UndoableRemoval): boolean {
  if (removedItem.kind === 'expense') return expensesApi.restoreExpense(removedItem.monthKey, removedItem.expense);
  if (removedItem.kind === 'income') return incomeApi.restoreIncome(removedItem.monthKey, removedItem.income);
  return recurringCostsApi.restoreRecurringCost(removedItem.monthKey, removedItem.list, removedItem.cost);
}
