/** Edits to fixed costs and subscriptions, recorded like expenses (see expenses-api.ts). */
import type { RecurringCostListName } from '../../../shared/month/categories.ts';
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

/** DELETE /api/months/:month/recurring/:list/:id */
export function removeRecurringCost(monthKey: string, list: RecurringCostListName, costId: string): boolean {
  return monthPageState.recordEdit('removeRecurringCost', { month: monthKey, list, id: costId }, undefined);
}
