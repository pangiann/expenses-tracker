/** Edits to categories and budgets, sent through the outbox like expenses (see expenses-api.ts). */
import { createUniqueId } from '../utils/ids.ts';
import { outbox } from './outbox.ts';

/** POST /api/months/:month/categories */
export function addCategory(monthKey: string, { name, color }: { name: string; color: string }): void {
  outbox.send('addCategory', { month: monthKey }, { id: createUniqueId(), name, color });
}

/** PUT /api/months/:month/categories/:id/name */
export function renameCategory(monthKey: string, categoryId: string, name: string): void {
  outbox.send('renameCategory', { month: monthKey, id: categoryId }, { name });
}

/** PUT /api/months/:month/categories/:id/position: just before another category, or last when null. */
export function moveCategory(monthKey: string, categoryId: string, beforeCategoryId: string | null): void {
  outbox.send('moveCategory', { month: monthKey, id: categoryId }, { beforeCategoryId });
}

/** PUT /api/months/:month/categories/:id/budget */
export function changeBudget(monthKey: string, categoryId: string, amount: number): void {
  outbox.send('changeBudget', { month: monthKey, id: categoryId }, { amount });
}

/** DELETE /api/months/:month/categories/:id */
export function removeCategory(monthKey: string, categoryId: string): void {
  outbox.send('removeCategory', { month: monthKey, id: categoryId }, undefined);
}
