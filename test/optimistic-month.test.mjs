import assert from 'node:assert/strict';
import { test } from 'vitest';

import { MonthRecord } from '../shared/month/month-record.ts';
import { buildOptimisticMonth } from '../web/scripts/sync/optimistic-month.ts';

const serverMonth = MonthRecord.createEmptyMonth('2026-11').toJSON();
const coffee = { id: 'e1', categoryId: 'lunch', amount: 3.5, date: '2026-11-03' };

test('unsaved edits show on top of the saved month, in order', () => {
  const shown = buildOptimisticMonth(serverMonth, [
    { name: 'addExpense', params: { month: '2026-11' }, body: coffee },
    { name: 'changeExpenseAmount', params: { month: '2026-11', id: 'e1' }, body: { amount: 4 } },
    { name: 'renameCategory', params: { month: '2026-11', id: 'lunch' }, body: { name: 'Coffee' } },
  ]);
  assert.deepEqual(shown.expenses, [{ id: 'e1', date: '2026-11-03', category: 'lunch', description: '', amount: 4 }]);
  assert.equal(shown.findCategory('lunch').name, 'Coffee');
  assert.equal(serverMonth.expenses.length, 0, 'the saved month itself is not changed');
});

test('edits for other months, malformed edits and edits that break a rule are skipped', () => {
  const shown = buildOptimisticMonth(serverMonth, [
    { name: 'addExpense', params: { month: '2026-10' }, body: { ...coffee, date: '2026-10-03' } },
    { name: 'addExpense', params: { month: '2026-11' }, body: { ...coffee, amount: 'lots' } },
    { name: 'addExpense', params: { month: '2026-11' }, body: { ...coffee, categoryId: 'casino' } },
    { name: 'getMonth', params: { month: '2026-11' }, body: undefined },
    { name: 'changeExpectedIncome', params: { month: '2026-11' }, body: { amount: 3000 } },
  ]);
  assert.equal(shown.expenses.length, 0);
  assert.equal(shown.expectedIncome, 3000, 'later edits still apply');
});
