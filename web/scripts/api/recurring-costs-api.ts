/** Edits to fixed costs and subscriptions, recorded like expenses (see expenses-api.ts). */
import type { RecurringCostListName } from '../../../shared/month/categories.ts';
import type { RecurringCost } from '../../../shared/month/month-record.ts';
import { createUniqueId } from '../utils/ids.ts';
import { monthPageState } from '../sync/month-page-state.ts';

/** POST /api/months/:month/recurring/:list */
export function addRecurringCost(monthKey: string, list: RecurringCostListName, name: string): boolean {
  return monthPageState.recordEdit('addRecurringCost', { month: monthKey, list }, { id: createUniqueId(), name });
}

/** PUT /api/months/:month/recurring/:list/:id/name */
export function renameRecurringCost(
  monthKey: string,
  list: RecurringCostListName,
  costId: string,
  name: string,
): boolean {
  return monthPageState.recordEdit('renameRecurringCost', { month: monthKey, list, id: costId }, { name });
}

/** PUT /api/months/:month/recurring/:list/:id/amount */
export function changeRecurringCostAmount(
  monthKey: string,
  list: RecurringCostListName,
  costId: string,
  amount: number,
): boolean {
  return monthPageState.recordEdit('changeRecurringCostAmount', { month: monthKey, list, id: costId }, { amount });
}

/** DELETE /api/months/:month/recurring/:list/:id. The page then offers to undo it for a few seconds. */
export function removeRecurringCost(monthKey: string, list: RecurringCostListName, costId: string): boolean {
  const cost = monthPageState
    .getSnapshot()
    .month?.recurringCostsIn(list)
    .find((recurringCost) => recurringCost.id === costId);
  const wasEditRecorded = monthPageState.recordEdit(
    'removeRecurringCost',
    { month: monthKey, list, id: costId },
    undefined,
  );
  if (wasEditRecorded && cost) monthPageState.offerUndo({ kind: 'recurringCost', monthKey, list, cost: { ...cost } });
  return wasEditRecorded;
}

/**
 * Undo for removeRecurringCost: adds the cost back with its own id and name, then sets its
 * amount, because a new cost starts at 0. It comes back at the end of its list: no endpoint
 * sets a cost's position. Like the expense undo, adding an id the month still has changes nothing.
 */
export function restoreRecurringCost(monthKey: string, list: RecurringCostListName, cost: RecurringCost): boolean {
  monthPageState.dismissUndo();
  const wasEditRecorded = monthPageState.recordEdit(
    'addRecurringCost',
    { month: monthKey, list },
    { id: cost.id, name: cost.name },
  );
  if (wasEditRecorded && cost.amount > 0) changeRecurringCostAmount(monthKey, list, cost.id, cost.amount);
  return wasEditRecorded;
}
