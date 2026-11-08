/** Export, import and the year summary: what they read and what they store. */
import { beforeEach, expect, test } from 'vitest';

import type { ExportResponse } from '../../shared/api/endpoints.ts';
import type { YearSummary } from '../../shared/month/year-summary.ts';
import { call, clearHousehold, storedEntries, storedMonth } from './helpers.ts';

const coffee = { id: 'e1', categoryId: 'lunch', amount: 3.5, description: 'coffee', date: '2026-11-03' };

beforeEach(clearHousehold);

test('export answers every stored month, exactly as stored', async () => {
  await call('POST', '/api/months/2026-10/expenses', { ...coffee, date: '2026-10-03' });
  await call('POST', '/api/months/2026-11/expenses', coffee);
  const { status, body } = await call<ExportResponse>('GET', '/api/export');
  expect(status).toBe(200);
  expect(body.months).toEqual([await storedMonth('2026-10'), await storedMonth('2026-11')]);
});

test('import stores the backup months, replacing those with the same key, and keeps the others', async () => {
  await call('POST', '/api/months/2026-11/expenses', coffee);
  await call('GET', '/api/months/2026-12');
  const { body: backup } = await call<ExportResponse>('GET', '/api/export');
  const november = backup.months.find((month) => month.month === '2026-11')!;
  const changed = { ...november, expenses: [], importedFrom: 'a test' };

  const imported = await call<{ count: number }>('POST', '/api/import', { months: [changed] });
  expect(imported).toEqual({ status: 200, body: { count: 1 } });
  const storedNovember = await storedMonth('2026-11');
  expect(storedNovember?.expenses).toEqual([]);
  expect(storedNovember?.importedFrom).toBe('a test'); // fields the app doesn't know are kept
  expect(await storedMonth('2026-12')).toBeDefined();
});

test('import refuses a backup in the older format, and stores nothing', async () => {
  const before = await storedEntries();
  const { status } = await call('POST', '/api/import', {
    months: [{ month: '2024-12', income: { expected: 0, actual: 0 }, expenses: [] }],
  });
  expect(status).toBe(400);
  expect(await storedEntries()).toEqual(before);
});

test('the year summary adds up the year and stores nothing', async () => {
  await call('POST', '/api/months/2026-10/expenses', { ...coffee, date: '2026-10-03' });
  await call('POST', '/api/months/2026-11/expenses', coffee);
  await call('POST', '/api/months/2026-11/expenses', { ...coffee, id: 'e2', amount: 6.5 });
  const before = await storedEntries();

  const { status, body } = await call<YearSummary>('GET', '/api/years/2026/summary');
  expect(status).toBe(200);
  expect(body.months.map((month) => month.month)).toEqual(['2026-10', '2026-11']);
  expect(body.months[1]!.spentPerCategory).toEqual({ lunch: 10 });
  expect(body.savedYears).toEqual([2026]);
  expect(await storedEntries()).toEqual(before);

  const emptyYear = await call<YearSummary>('GET', '/api/years/2031/summary');
  expect(emptyYear.body.months).toEqual([]);
  expect(await storedEntries()).toEqual(before);
});
