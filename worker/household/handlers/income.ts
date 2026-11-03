import { editMonth } from '../household.ts';
import type { Handler } from './handler.ts';

/** POST /api/months/:month/income */
export const addIncome: Handler<'addIncome'> = ({ params, body }, household) =>
  editMonth(household, params.month, (month) => month.addIncome(body));

/** PUT /api/months/:month/income/:id/amount */
export const changeIncomeAmount: Handler<'changeIncomeAmount'> = ({ params, body }, household) =>
  editMonth(household, params.month, (month) => month.updateIncomeAmount(params.id, body.amount));

/** DELETE /api/months/:month/income/:id */
export const removeIncome: Handler<'removeIncome'> = ({ params }, household) =>
  editMonth(household, params.month, (month) => month.removeIncome(params.id));

/** PUT /api/months/:month/expected-income */
export const changeExpectedIncome: Handler<'changeExpectedIncome'> = ({ params, body }, household) =>
  editMonth(household, params.month, (month) => month.setExpectedIncome(body.amount));
