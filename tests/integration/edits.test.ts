/**
 * Every editing endpoint: the stored month after the edit is the one answered, the revision goes
 * up by one, and the edit did what it says. Each test opens the month first: an edit to a month
 * that doesn't exist yet saves twice (the new month, then the edit), so the revision goes up by 2.
 */
import { beforeEach, expect, test } from 'vitest';

import type { MonthResponse } from '../../shared/api/endpoints.ts';
import type { MonthData } from '../../shared/month/month-record.ts';
import { call, clearHousehold, storedMonth, storedRevision } from './helpers.ts';

const MONTH = '/api/months/2026-11';
const coffee = { id: 'e1', categoryId: 'lunch', amount: 3.5, description: 'coffee', date: '2026-11-03' };
const lesson = { id: 'i1', amount: 40, description: 'lesson', date: '2026-11-04' };

beforeEach(async () => {
  await clearHousehold();
  await call('GET', MONTH);
});

/** Sends one edit and checks the parts every edit shares; returns the stored month. */
async function edit(method: string, path: string, body?: unknown): Promise<MonthData> {
  const revisionBefore = (await storedRevision()) ?? 0;
  const answer = await call<MonthResponse>(method, `${MONTH}${path}`, body);
  expect(answer.status, `${method} ${path}`).toBe(200);
  const stored = await storedMonth('2026-11');
  expect(stored).toEqual(answer.body.month);
  expect(await storedRevision()).toBe(revisionBefore + 1);
  expect(answer.body.revision).toBe(revisionBefore + 1);
  return stored!;
}

test('expenses: add, change the amount, remove', async () => {
  let month = await edit('POST', '/expenses', coffee);
  expect(month.expenses).toEqual([
    { id: 'e1', category: 'lunch', amount: 3.5, description: 'coffee', date: '2026-11-03' },
  ]);

  month = await edit('POST', '/expenses', coffee); // the same edit sent twice
  expect(month.expenses).toHaveLength(1);

  month = await edit('PUT', '/expenses/e1/amount', { amount: 4.2 });
  expect(month.expenses[0]!.amount).toBe(4.2);

  month = await edit('DELETE', '/expenses/e1');
  expect(month.expenses).toEqual([]);
});

test('income: add, change the amount, remove, and the expected income', async () => {
  let month = await edit('POST', '/income', lesson);
  expect(month.income.entries).toEqual([lesson]);
  expect(month.income.actual).toBe(40);

  month = await edit('PUT', '/income/i1/amount', { amount: 55 });
  expect(month.income.entries[0]!.amount).toBe(55);

  month = await edit('DELETE', '/income/i1');
  expect(month.income.entries).toEqual([]);

  month = await edit('PUT', '/expected-income', { amount: 3500 });
  expect(month.income.expected).toBe(3500);
});

test('categories: add, rename, move, budget, remove', async () => {
  let month = await edit('POST', '/categories', { id: 'kids', name: ' Kids ' });
  expect(month.categories.at(-1)).toEqual({ id: 'kids', name: 'Kids' });
  expect(month.budgets.kids).toBe(0);

  month = await edit('PUT', '/categories/kids/name', { name: 'Children' });
  expect(month.categories.at(-1)).toEqual({ id: 'kids', name: 'Children' });

  month = await edit('PUT', '/categories/kids/position', { beforeCategoryId: 'dinner' });
  expect(month.categories[0]!.id).toBe('kids');

  month = await edit('PUT', '/categories/kids/budget', { amount: 120 });
  expect(month.budgets.kids).toBe(120);

  month = await edit('DELETE', '/categories/kids');
  expect(month.categories.some((category) => category.id === 'kids')).toBe(false);
  expect(month.budgets.kids).toBeUndefined();
});

test('fixed costs and subscriptions: add, rename, change the amount, remove', async () => {
  let month = await edit('POST', '/recurring/subscriptions', { id: 's1', name: 'Music' });
  expect(month.subscriptions).toEqual([{ id: 's1', name: 'Music', amount: 0 }]);

  month = await edit('PUT', '/recurring/subscriptions/s1/name', { name: 'Radio' });
  expect(month.subscriptions[0]!.name).toBe('Radio');
  month = await edit('PUT', '/recurring/subscriptions/s1/amount', { amount: 11 });
  expect(month.subscriptions).toEqual([{ id: 's1', name: 'Radio', amount: 11 }]);

  month = await edit('PUT', '/recurring/fixed/fixed-1/amount', { amount: 900 });
  expect(month.fixed[0]).toEqual({ id: 'fixed-1', name: 'Rent', amount: 900 });

  month = await edit('DELETE', '/recurring/subscriptions/s1');
  expect(month.subscriptions).toEqual([]);
});

test('the first edit to a month that does not exist yet creates the month, then saves the edit', async () => {
  await clearHousehold();
  const { body } = await call<MonthResponse>('POST', `${MONTH}/expenses`, coffee);
  expect(body.revision).toBe(2);
  expect((await storedMonth('2026-11'))?.expenses).toHaveLength(1);
});

test('an edit to one month leaves the other months as they were', async () => {
  await call('POST', '/api/months/2026-10/expenses', { ...coffee, date: '2026-10-03' });
  const october = await storedMonth('2026-10');
  await edit('POST', '/expenses', coffee);
  expect(await storedMonth('2026-10')).toEqual(october);
});
