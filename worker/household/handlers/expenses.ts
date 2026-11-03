import { editMonth } from '../household.ts';
import type { Handler } from './handler.ts';

/** POST /api/months/:month/expenses */
export const addExpense: Handler<'addExpense'> = ({ params, body }, household) =>
  editMonth(household, params.month, (month) => month.addExpense(body));

/** PUT /api/months/:month/expenses/:id/amount */
export const changeExpenseAmount: Handler<'changeExpenseAmount'> = ({ params, body }, household) =>
  editMonth(household, params.month, (month) => month.updateExpenseAmount(params.id, body.amount));

/** DELETE /api/months/:month/expenses/:id */
export const removeExpense: Handler<'removeExpense'> = ({ params }, household) =>
  editMonth(household, params.month, (month) => month.removeExpense(params.id));
