import { editMonth } from '../household.ts';
import type { Handler } from './handler.ts';

/** POST /api/months/:month/categories */
export const addCategory: Handler<'addCategory'> = ({ params, body }, household) =>
  editMonth(household, params.month, (month) => month.addCategory(body));

/** PUT /api/months/:month/categories/:id/name */
export const renameCategory: Handler<'renameCategory'> = ({ params, body }, household) =>
  editMonth(household, params.month, (month) => month.renameCategory(params.id, body.name));

/** PUT /api/months/:month/categories/:id/position */
export const moveCategory: Handler<'moveCategory'> = ({ params, body }, household) =>
  editMonth(household, params.month, (month) => month.moveCategory(params.id, body.beforeCategoryId));

/** PUT /api/months/:month/categories/:id/budget */
export const changeBudget: Handler<'changeBudget'> = ({ params, body }, household) =>
  editMonth(household, params.month, (month) => month.setBudget(params.id, body.amount));

/** DELETE /api/months/:month/categories/:id */
export const removeCategory: Handler<'removeCategory'> = ({ params }, household) =>
  editMonth(household, params.month, (month) => month.removeCategory(params.id));
