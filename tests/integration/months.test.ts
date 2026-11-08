import { beforeEach, expect, test } from 'vitest';

import type { MonthResponse } from '../../shared/api/endpoints.ts';
import { call, clearHousehold, storedEntries, storedMonth, storedRevision } from './helpers.ts';

beforeEach(clearHousehold);

test('opening a month that does not exist creates it, saves it and answers it', async () => {
  expect([...(await storedEntries()).keys()]).toEqual([]);

  const { status, body } = await call<MonthResponse>('GET', '/api/months/2026-11');
  expect(status).toBe(200);
  expect(body.month.month).toBe('2026-11');
  expect(body.monthKeys).toEqual(['2026-11']);
  expect(body.revision).toBe(1);

  // What the household stored is exactly what it answered.
  expect(await storedMonth('2026-11')).toEqual(body.month);
  expect(await storedRevision()).toBe(1);
  expect(body.month.categories).toHaveLength(11);
  expect(body.month.fixed.map((cost) => cost.id)).toEqual(['fixed-1', 'fixed-2', 'fixed-3']);
});

test('opening a month that exists changes nothing', async () => {
  await call('GET', '/api/months/2026-11');
  const before = await storedEntries();
  const { body } = await call<MonthResponse>('GET', '/api/months/2026-11');
  expect(body.revision).toBe(1);
  expect(await storedEntries()).toEqual(before);
});

test('a new month copies the closest earlier month, without its expenses or income', async () => {
  await call('PUT', '/api/months/2026-10/categories/lunch/budget', { amount: 90 });
  await call('POST', '/api/months/2026-10/expenses', {
    id: 'e1',
    categoryId: 'lunch',
    amount: 4,
    description: 'coffee',
    date: '2026-10-03',
  });
  const { body } = await call<MonthResponse>('GET', '/api/months/2026-11');
  expect(body.month.budgets.lunch).toBe(90);
  expect(body.month.expenses).toEqual([]);
  expect(body.monthKeys).toEqual(['2026-10', '2026-11']);
});
