import assert from 'node:assert/strict';
import { test } from 'node:test';

import { MonthRecord } from '../web/scripts/model/MonthRecord.js';
import { ChangeKind, InvalidChangeError, applyMonthChange } from '../web/scripts/model/monthChanges.js';
import { closestSavedMonthKey, isMonthData } from '../web/scripts/model/monthValidation.js';

const novemberWithRent = () => new MonthRecord({
  month: '2026-11',
  income: { expected: 4000, actual: 0 },
  budgets: { dinner: 130 },
  expenses: [],
  fixed: [{ name: 'Rent', amount: 1000 }],
  subscriptions: [],
});

const coffee = { id: 'expense-1', categoryKey: 'lunch', amount: 3.5, description: 'coffee', date: '2026-11-03' };

test('adding the same expense twice keeps one copy (safe to resend after a reconnect)', () => {
  const month = novemberWithRent();
  applyMonthChange(month, { kind: ChangeKind.ADD_EXPENSE, expense: coffee });
  applyMonthChange(month, { kind: ChangeKind.ADD_EXPENSE, expense: coffee });
  assert.equal(month.expenses.length, 1);
  assert.equal(month.spentInCategory('lunch'), 3.5);
});

test('changes from two people on different expenses both survive', () => {
  const month = novemberWithRent();
  applyMonthChange(month, { kind: ChangeKind.ADD_EXPENSE, expense: coffee });
  applyMonthChange(month, { kind: ChangeKind.ADD_EXPENSE, expense: { ...coffee, id: 'expense-2', amount: 12 } });
  applyMonthChange(month, { kind: ChangeKind.CHANGE_EXPENSE_AMOUNT, expenseId: 'expense-1', amount: 4 });
  assert.deepEqual(month.expenses.map((expense) => expense.amount), [4, 12]);
});

test('budgets, income and recurring costs change through the same path', () => {
  const month = novemberWithRent();
  applyMonthChange(month, { kind: ChangeKind.CHANGE_BUDGET, categoryKey: 'travel', amount: 200 });
  applyMonthChange(month, { kind: ChangeKind.CHANGE_ACTUAL_INCOME, amount: 3000 });
  applyMonthChange(month, { kind: ChangeKind.RENAME_RECURRING_COST, listName: 'fixed', position: 0, name: 'Flat' });
  applyMonthChange(month, { kind: ChangeKind.ADD_RECURRING_COST, listName: 'subscriptions' });
  assert.equal(month.budgetFor('travel'), 200);
  assert.equal(month.income.actual, 3000);
  assert.equal(month.recurringCostsIn('fixed')[0].name, 'Flat');
  assert.equal(month.recurringCostsIn('subscriptions').length, 1);
});

test('malformed changes from the network are refused', () => {
  const month = novemberWithRent();
  const refusedChanges = [
    { kind: 'deleteEverything' },
    { kind: ChangeKind.ADD_EXPENSE, expense: { ...coffee, amount: -5 } },
    { kind: ChangeKind.ADD_EXPENSE, expense: { ...coffee, amount: '5' } },
    { kind: ChangeKind.ADD_EXPENSE, expense: { ...coffee, categoryKey: 'casino' } },
    { kind: ChangeKind.ADD_EXPENSE, expense: { ...coffee, date: '2026-12-01' } }, // not in November
    { kind: ChangeKind.ADD_EXPENSE, expense: { ...coffee, description: 'x'.repeat(500) } },
    { kind: ChangeKind.CHANGE_BUDGET, categoryKey: 'lunch', amount: Number.POSITIVE_INFINITY },
    { kind: ChangeKind.REMOVE_RECURRING_COST, listName: 'fixed', position: 5 },
    { kind: ChangeKind.REMOVE_RECURRING_COST, listName: '__proto__', position: 0 },
  ];
  for (const change of refusedChanges) {
    assert.throws(() => applyMonthChange(month, change), InvalidChangeError, JSON.stringify(change));
  }
  assert.equal(month.expenses.length, 0);
});

test('a new month copies budgets and recurring costs, not expenses or earned income', () => {
  const october = novemberWithRent();
  applyMonthChange(october, { kind: ChangeKind.ADD_EXPENSE, expense: coffee });
  applyMonthChange(october, { kind: ChangeKind.CHANGE_ACTUAL_INCOME, amount: 3900 });
  const december = MonthRecord.createFromTemplate(october, '2026-12');
  assert.equal(december.expenses.length, 0);
  assert.equal(december.income.actual, 0);
  assert.equal(december.income.expected, 4000);
  assert.equal(december.recurringCostsIn('fixed')[0].amount, 1000);
});

test('closestSavedMonthKey prefers the latest earlier month', () => {
  const saved = ['2026-08', '2026-09', '2026-11'];
  assert.equal(closestSavedMonthKey(saved, '2026-10'), '2026-09');
  assert.equal(closestSavedMonthKey(saved, '2026-01'), '2026-08');
  assert.equal(closestSavedMonthKey([], '2026-01'), null);
});

test('isMonthData accepts month files and rejects anything else', () => {
  assert.equal(isMonthData(novemberWithRent().toJSON()), true);
  assert.equal(isMonthData({ month: '2026-13', expenses: [] }), false);
  assert.equal(isMonthData({ month: '2026-11' }), false);
  assert.equal(isMonthData(null), false);
});
