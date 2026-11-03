import { editMonth } from '../household.ts';
import type { Handler } from './handler.ts';

/** POST /api/months/:month/recurring/:list */
export const addRecurringCost: Handler<'addRecurringCost'> = ({ params, body }, household) =>
  editMonth(household, params.month, (month) => month.addRecurringCost(params.list, body));

/** PUT /api/months/:month/recurring/:list/:id/name */
export const renameRecurringCost: Handler<'renameRecurringCost'> = ({ params, body }, household) =>
  editMonth(household, params.month, (month) => month.renameRecurringCost(params.list, params.id, body.name));

/** PUT /api/months/:month/recurring/:list/:id/amount */
export const changeRecurringCostAmount: Handler<'changeRecurringCostAmount'> = ({ params, body }, household) =>
  editMonth(household, params.month, (month) => month.setRecurringCostAmount(params.list, params.id, body.amount));

/** DELETE /api/months/:month/recurring/:list/:id */
export const removeRecurringCost: Handler<'removeRecurringCost'> = ({ params }, household) =>
  editMonth(household, params.month, (month) => month.removeRecurringCost(params.list, params.id));
