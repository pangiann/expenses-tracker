import assert from 'node:assert/strict';
import { test } from 'vitest';

import { MonthRecord } from '../shared/month/month-record.ts';
import { summarizeYear } from '../shared/month/year-summary.ts';

function monthWith(monthKey, expenses, { income = 0, categories } = {}) {
  const month = MonthRecord.createEmptyMonth(monthKey);
  if (categories) month.categories = categories;
  if (income) month.addIncome({ id: 'salary', amount: income, description: 'salary', date: `${monthKey}-01` });
  for (const [id, categoryId, amount] of expenses) {
    month.addExpense({ id, categoryId, amount, description: '', date: `${monthKey}-02` });
  }
  return month;
}

test('each month is summed up, oldest first, with spending per category', () => {
  const november = monthWith(
    '2026-11',
    [
      ['e1', 'lunch', 4],
      ['e2', 'lunch', 6],
      ['e3', 'home', 20],
    ],
    { income: 100 },
  );
  november.setRecurringCostAmount('fixed', 'fixed-1', 50);
  const october = monthWith('2026-10', [['e4', 'gifts', 15]]);

  const summary = summarizeYear(2026, [november, october], ['2025-12', '2026-10', '2026-11']);
  assert.deepEqual(
    summary.months.map((month) => month.month),
    ['2026-10', '2026-11'],
  );
  assert.deepEqual(summary.months[1], {
    month: '2026-11',
    earned: 100,
    spent: 80,
    variableSpending: 30,
    recurringCostsTotal: 50,
    budgeted: 50,
    saved: 20,
    spentPerCategory: { lunch: 10, home: 20 },
  });
  assert.deepEqual(summary.savedYears, [2025, 2026]);
});

test('categories follow the latest month, then those only earlier months had', () => {
  const june = monthWith('2026-06', [], {
    categories: [
      { id: 'pets', name: 'Pets' },
      { id: 'kids', name: 'Kids' },
    ],
  });
  const july = monthWith('2026-07', [], { categories: [{ id: 'kids', name: 'Children' }] });
  const summary = summarizeYear(2026, [june, july], ['2026-06', '2026-07']);
  assert.deepEqual(summary.categories, [
    { id: 'kids', name: 'Children' },
    { id: 'pets', name: 'Pets' },
  ]);
});
