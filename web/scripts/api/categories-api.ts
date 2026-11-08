/** Edits to categories and budgets, recorded like expenses (see expenses-api.ts). */
import { createUniqueId } from '../utils/ids.ts';
import { monthPageState } from '../sync/month-page-state.ts';

/** POST /api/months/:month/categories */
export function addCategory(monthKey: string, { name }: { name: string }): boolean {
  return monthPageState.recordEdit('addCategory', { month: monthKey }, { id: createUniqueId(), name });
}

/** PUT /api/months/:month/categories/:id/name */
export function renameCategory(monthKey: string, categoryId: string, name: string): boolean {
  return monthPageState.recordEdit('renameCategory', { month: monthKey, id: categoryId }, { name });
}

/** PUT /api/months/:month/categories/:id/position: just before another category, or last when null. */
export function moveCategory(monthKey: string, categoryId: string, beforeCategoryId: string | null): boolean {
  return monthPageState.recordEdit('moveCategory', { month: monthKey, id: categoryId }, { beforeCategoryId });
}

/** PUT /api/months/:month/categories/:id/budget */
export function changeBudget(monthKey: string, categoryId: string, amount: number): boolean {
  return monthPageState.recordEdit('changeBudget', { month: monthKey, id: categoryId }, { amount });
}

/** DELETE /api/months/:month/categories/:id */
export function removeCategory(monthKey: string, categoryId: string): boolean {
  return monthPageState.recordEdit('removeCategory', { month: monthKey, id: categoryId }, undefined);
}
