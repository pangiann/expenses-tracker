/** Edits to fixed costs and subscriptions, sent through the outbox like expenses (see expenses-api.ts). */
import type { RecurringCostListName } from '../../../shared/month/categories.ts';
import { createUniqueId } from '../utils/ids.ts';
import { pendingEditsOutbox } from './pending-edits-outbox.ts';

/** POST /api/months/:month/recurring/:list */
export function addRecurringCost(monthKey: string, list: RecurringCostListName, name: string): boolean {
  return pendingEditsOutbox.send('addRecurringCost', { month: monthKey, list }, { id: createUniqueId(), name });
}

/** PUT /api/months/:month/recurring/:list/:id/name */
export function renameRecurringCost(
  monthKey: string,
  list: RecurringCostListName,
  costId: string,
  name: string,
): boolean {
  return pendingEditsOutbox.send('renameRecurringCost', { month: monthKey, list, id: costId }, { name });
}

/** PUT /api/months/:month/recurring/:list/:id/amount */
export function changeRecurringCostAmount(
  monthKey: string,
  list: RecurringCostListName,
  costId: string,
  amount: number,
): boolean {
  return pendingEditsOutbox.send('changeRecurringCostAmount', { month: monthKey, list, id: costId }, { amount });
}

/** DELETE /api/months/:month/recurring/:list/:id */
export function removeRecurringCost(monthKey: string, list: RecurringCostListName, costId: string): boolean {
  return pendingEditsOutbox.send('removeRecurringCost', { month: monthKey, list, id: costId }, undefined);
}
