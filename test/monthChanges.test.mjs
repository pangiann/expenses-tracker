import assert from 'node:assert/strict';
import { test } from 'vitest';

import { MonthRecord } from '../shared/month/month-record.js';
import { ChangeKind, InvalidChangeError, applyMonthChange } from '../shared/month/month-changes.js';
import { closestSavedMonthKey, isMonthData } from '../shared/month/month-validation.ts';

const novemberWithRent = () =>
  new MonthRecord({
    month: '2026-11',
    income: { expected: 4000, entries: [] },
    budgets: { dinner: 130 },
    expenses: [],
    fixed: [
      { id: 'rent', name: 'Rent', amount: 1000 },
      { id: 'internet', name: 'Internet', amount: 30 },
    ],
    subscriptions: [],
  });

const coffee = { id: 'expense-1', categoryKey: 'lunch', amount: 3.5, description: 'coffee', date: '2026-11-03' };
const lesson = { id: 'income-1', amount: 40, description: 'lesson', date: '2026-11-04' };

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
  assert.deepEqual(
    month.expenses.map((expense) => expense.amount),
    [4, 12],
  );
});

test('income is a list of entries, and Earned is their total', () => {
  const month = novemberWithRent();
  applyMonthChange(month, { kind: ChangeKind.ADD_INCOME, income: lesson });
  applyMonthChange(month, { kind: ChangeKind.ADD_INCOME, income: { ...lesson, id: 'income-2', amount: 35.5 } });
  applyMonthChange(month, { kind: ChangeKind.ADD_INCOME, income: lesson }); // resent: no duplicate
  assert.equal(month.totalIncome, 75.5);
  applyMonthChange(month, { kind: ChangeKind.CHANGE_INCOME_AMOUNT, incomeId: 'income-2', amount: 45 });
  applyMonthChange(month, { kind: ChangeKind.REMOVE_INCOME, incomeId: 'income-1' });
  assert.equal(month.totalIncome, 45);
  assert.equal(month.calculateTotals().saved, 45 - 1030);
  assert.equal(month.toJSON().income.actual, 45);
});

test('an older file with one income number becomes one entry, the same on every device', () => {
  const oldFile = { month: '2026-08', income: { expected: 4000, actual: 3500 }, expenses: [] };
  const onPhone = new MonthRecord(oldFile);
  const onServer = new MonthRecord(oldFile);
  assert.equal(onPhone.totalIncome, 3500);
  assert.deepEqual(onPhone.incomes, onServer.incomes);
  applyMonthChange(onServer, { kind: ChangeKind.CHANGE_INCOME_AMOUNT, incomeId: onPhone.incomes[0].id, amount: 3950 });
  assert.equal(onServer.totalIncome, 3950);
});

test('fixed costs are found by id, so edits hit the right row after others are removed', () => {
  const month = novemberWithRent();
  applyMonthChange(month, { kind: ChangeKind.REMOVE_RECURRING_COST, listName: 'fixed', costId: 'rent' });
  applyMonthChange(month, {
    kind: ChangeKind.RENAME_RECURRING_COST,
    listName: 'fixed',
    costId: 'internet',
    name: 'Fibre',
  });
  applyMonthChange(month, {
    kind: ChangeKind.CHANGE_RECURRING_COST_AMOUNT,
    listName: 'fixed',
    costId: 'internet',
    amount: 35,
  });
  assert.deepEqual(month.recurringCostsIn('fixed'), [{ id: 'internet', name: 'Fibre', amount: 35 }]);
  // Editing a row someone else removed does nothing instead of failing.
  applyMonthChange(month, { kind: ChangeKind.RENAME_RECURRING_COST, listName: 'fixed', costId: 'rent', name: 'Flat' });
  assert.equal(month.recurringCostsIn('fixed').length, 1);
});

test('adding the same fixed cost twice keeps one row', () => {
  const month = novemberWithRent();
  const addGym = { kind: ChangeKind.ADD_RECURRING_COST, listName: 'subscriptions', cost: { id: 'gym', name: 'Gym' } };
  applyMonthChange(month, addGym);
  applyMonthChange(month, addGym);
  assert.equal(month.recurringCostsIn('subscriptions').length, 1);
});

test('older fixed costs without ids get the same ids on every device', () => {
  const oldFile = {
    month: '2026-08',
    expenses: [],
    fixed: [
      { name: 'Rent', amount: 880 },
      { name: 'Internet', amount: 30 },
    ],
  };
  assert.deepEqual(
    new MonthRecord(oldFile).recurringCostsIn('fixed').map((cost) => cost.id),
    ['fixed-1', 'fixed-2'],
  );
  assert.deepEqual(new MonthRecord(oldFile).toJSON().fixed[1], { name: 'Internet', amount: 30, id: 'fixed-2' });
});

test('budgets and expected income change through the same path', () => {
  const month = novemberWithRent();
  applyMonthChange(month, { kind: ChangeKind.CHANGE_BUDGET, categoryKey: 'travel', amount: 200 });
  applyMonthChange(month, { kind: ChangeKind.CHANGE_EXPECTED_INCOME, amount: 4200 });
  assert.equal(month.budgetFor('travel'), 200);
  assert.equal(month.expectedIncome, 4200);
});

test('malformed changes from the network are refused', () => {
  const month = novemberWithRent();
  const refusedChanges = [
    { kind: 'deleteEverything' },
    { kind: 'changeActualIncome', amount: 100 }, // removed: income is now a list
    { kind: ChangeKind.ADD_EXPENSE, expense: { ...coffee, amount: -5 } },
    { kind: ChangeKind.ADD_EXPENSE, expense: { ...coffee, amount: '5' } },
    { kind: ChangeKind.ADD_EXPENSE, expense: { ...coffee, categoryKey: 'casino' } },
    { kind: ChangeKind.ADD_EXPENSE, expense: { ...coffee, date: '2026-12-01' } }, // not in November
    { kind: ChangeKind.ADD_EXPENSE, expense: { ...coffee, description: 'x'.repeat(500) } },
    { kind: ChangeKind.ADD_INCOME, income: { ...lesson, amount: 0 } },
    { kind: ChangeKind.ADD_INCOME, income: { ...lesson, id: '' } },
    { kind: ChangeKind.CHANGE_BUDGET, categoryKey: 'lunch', amount: Number.POSITIVE_INFINITY },
    { kind: ChangeKind.ADD_RECURRING_COST, listName: 'fixed', cost: { id: 'x', name: '   ' } },
    { kind: ChangeKind.REMOVE_RECURRING_COST, listName: '__proto__', costId: 'rent' },
  ];
  for (const change of refusedChanges) {
    assert.throws(() => applyMonthChange(month, change), InvalidChangeError, JSON.stringify(change));
  }
  assert.equal(month.expenses.length, 0);
  assert.equal(month.incomes.length, 0);
});

test('a new month copies budgets, expected income and fixed costs, not expenses or income entries', () => {
  const october = novemberWithRent();
  applyMonthChange(october, { kind: ChangeKind.ADD_EXPENSE, expense: coffee });
  applyMonthChange(october, { kind: ChangeKind.ADD_INCOME, income: lesson });
  const december = MonthRecord.createFromTemplate(october, '2026-12');
  assert.equal(december.expenses.length, 0);
  assert.equal(december.totalIncome, 0);
  assert.equal(december.expectedIncome, 4000);
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

test('an older file without a category list gets the 11 default categories', () => {
  const month = new MonthRecord({ month: '2026-08', expenses: [], budgets: { dinner: 130 } });
  assert.equal(month.categories.length, 11);
  assert.equal(month.categories[0].id, 'dinner');
  assert.equal(month.budgetFor('dinner'), 130);
  assert.equal(month.toJSON().categories.length, 11);
});

test('a month keeps its own category list, and a new month copies it', () => {
  const october = new MonthRecord({
    month: '2026-10',
    expenses: [],
    categories: [
      { id: 'kids', name: 'Kids', color: '#f59e0b' },
      { id: 'other', nameId: 'category.other', color: '#8a92a6' },
    ],
    budgets: { kids: 100, other: 20 },
  });
  const november = MonthRecord.createFromTemplate(october, '2026-11');
  assert.deepEqual(
    november.categories.map((category) => category.id),
    ['kids', 'other'],
  );
  assert.equal(november.budgetFor('kids'), 100);
  assert.equal(november.calculateTotals().totalBudgeted, 120);
});

test('expenses and budgets are refused for a category the month does not have', () => {
  const month = new MonthRecord({
    month: '2026-10',
    expenses: [],
    categories: [{ id: 'kids', name: 'Kids', color: '#f59e0b' }],
  });
  const groceries = { id: 'expense-9', categoryKey: 'supermarket', amount: 20, description: '', date: '2026-10-02' };
  assert.throws(
    () => applyMonthChange(month, { kind: ChangeKind.ADD_EXPENSE, expense: groceries }),
    InvalidChangeError,
  );
  assert.throws(
    () => applyMonthChange(month, { kind: ChangeKind.CHANGE_BUDGET, categoryKey: 'supermarket', amount: 5 }),
    InvalidChangeError,
  );
  applyMonthChange(month, { kind: ChangeKind.ADD_EXPENSE, expense: { ...groceries, categoryKey: 'kids' } });
  assert.equal(month.spentInCategory('kids'), 20);
});

test('adding a category puts it at the end with a budget of 0, once', () => {
  const month = new MonthRecord({ month: '2026-11', expenses: [] });
  const addKids = { kind: ChangeKind.ADD_CATEGORY, category: { id: 'kids', name: ' Kids ', color: '#f59e0b' } };
  applyMonthChange(month, addKids);
  applyMonthChange(month, addKids); // resent after a reconnect
  assert.equal(month.categories.length, 12);
  assert.deepEqual(month.categories[11], { id: 'kids', name: 'Kids', color: '#f59e0b' });
  assert.equal(month.budgetFor('kids'), 0);
  applyMonthChange(month, {
    kind: ChangeKind.ADD_EXPENSE,
    expense: { id: 'expense-k', categoryKey: 'kids', amount: 15, description: 'toys', date: '2026-11-05' },
  });
  assert.equal(month.spentInCategory('kids'), 15);
  assert.equal(MonthRecord.createFromTemplate(month, '2026-12').findCategory('kids').name, 'Kids');
});

test('a new category gets a colour no other category in the month uses', () => {
  const month = new MonthRecord({ month: '2026-11', expenses: [] });
  const firstColor = month.pickCategoryColor();
  applyMonthChange(month, { kind: ChangeKind.ADD_CATEGORY, category: { id: 'a', name: 'A', color: firstColor } });
  assert.notEqual(month.pickCategoryColor(), firstColor);
});

test('malformed new categories are refused', () => {
  const month = new MonthRecord({ month: '2026-11', expenses: [] });
  for (const category of [
    { id: 'x', name: '  ', color: '#f59e0b' },
    { id: 'x', name: 'X', color: 'red' },
    { id: 'x', name: 'X', color: '#f59e0b"><script>' },
    { id: '', name: 'X', color: '#f59e0b' },
  ]) {
    assert.throws(() => applyMonthChange(month, { kind: ChangeKind.ADD_CATEGORY, category }), InvalidChangeError);
  }
  assert.equal(month.categories.length, 11);
});

test('two categories added at the same moment with the same colour end up with different colours', () => {
  const month = new MonthRecord({ month: '2026-11', expenses: [] });
  const sameColor = month.pickCategoryColor();
  applyMonthChange(month, { kind: ChangeKind.ADD_CATEGORY, category: { id: 'kids', name: 'Kids', color: sameColor } });
  applyMonthChange(month, { kind: ChangeKind.ADD_CATEGORY, category: { id: 'pets', name: 'Pets', color: sameColor } });
  assert.notEqual(month.findCategory('kids').color, month.findCategory('pets').color);
});

test('category names must be unique (ignoring capitals and spaces) and at most 20 characters', () => {
  const month = new MonthRecord({ month: '2026-11', expenses: [] });
  const add = (id, name) =>
    applyMonthChange(month, { kind: ChangeKind.ADD_CATEGORY, category: { id, name, color: '#f59e0b' } });
  add('kids', 'Kids');
  assert.throws(() => add('kids-2', '  KIDS '), InvalidChangeError);
  assert.throws(() => add('long', 'x'.repeat(21)), InvalidChangeError);
  add('twenty', 'x'.repeat(20));
  assert.deepEqual(
    month.categories.slice(11).map((category) => category.id),
    ['kids', 'twenty'],
  );
});

test('renaming a category keeps its id, expenses and budget', () => {
  const month = new MonthRecord({ month: '2026-11', expenses: [], budgets: { dinner: 130 } });
  applyMonthChange(month, {
    kind: ChangeKind.ADD_EXPENSE,
    expense: { id: 'expense-d', categoryKey: 'dinner', amount: 30, description: 'pizza', date: '2026-11-02' },
  });
  applyMonthChange(month, { kind: ChangeKind.RENAME_CATEGORY, categoryId: 'dinner', name: ' Eating out ' });
  assert.deepEqual(month.findCategory('dinner'), { id: 'dinner', name: 'Eating out', color: '#e8618c' }); // no nameId: same name in every language
  assert.equal(month.spentInCategory('dinner'), 30);
  assert.equal(month.budgetFor('dinner'), 130);
});

test('renaming follows the name rules, but a category may keep its own name in other capitals', () => {
  const month = new MonthRecord({ month: '2026-11', expenses: [] });
  applyMonthChange(month, { kind: ChangeKind.ADD_CATEGORY, category: { id: 'kids', name: 'kids', color: '#f59e0b' } });
  applyMonthChange(month, { kind: ChangeKind.ADD_CATEGORY, category: { id: 'pets', name: 'Pets', color: '#ef4444' } });
  applyMonthChange(month, { kind: ChangeKind.RENAME_CATEGORY, categoryId: 'kids', name: 'Kids' });
  assert.equal(month.findCategory('kids').name, 'Kids');
  for (const name of ['PETS', '', 'x'.repeat(21)]) {
    assert.throws(
      () => applyMonthChange(month, { kind: ChangeKind.RENAME_CATEGORY, categoryId: 'kids', name }),
      InvalidChangeError,
    );
  }
  // Renaming a category someone else removed does nothing.
  applyMonthChange(month, { kind: ChangeKind.RENAME_CATEGORY, categoryId: 'gone', name: 'Anything' });
  assert.equal(month.categories.length, 13);
});

test('an empty category can be removed, with its budget; removing it again does nothing', () => {
  const month = new MonthRecord({ month: '2026-11', expenses: [], budgets: { gifts: 60 } });
  applyMonthChange(month, { kind: ChangeKind.REMOVE_CATEGORY, categoryId: 'gifts' });
  applyMonthChange(month, { kind: ChangeKind.REMOVE_CATEGORY, categoryId: 'gifts' }); // resent
  assert.equal(month.findCategory('gifts'), undefined);
  assert.equal(month.budgets.gifts, undefined);
  assert.equal(month.categories.length, 10);
  assert.equal(MonthRecord.createFromTemplate(month, '2026-12').findCategory('gifts'), undefined);
});

test('a category with expenses, or the last category, cannot be removed', () => {
  const month = new MonthRecord({
    month: '2026-11',
    expenses: [{ id: 'e1', category: 'lunch', description: 'coffee', amount: 3, date: '2026-11-02' }],
  });
  assert.equal(month.categoryRemovalBlocker('lunch'), 'has-expenses');
  assert.throws(
    () => applyMonthChange(month, { kind: ChangeKind.REMOVE_CATEGORY, categoryId: 'lunch' }),
    InvalidChangeError,
  );
  assert.ok(month.findCategory('lunch'));

  const onlyOne = new MonthRecord({
    month: '2026-11',
    expenses: [],
    categories: [{ id: 'kids', name: 'Kids', color: '#f59e0b' }],
  });
  assert.equal(onlyOne.categoryRemovalBlocker('kids'), 'last-category');
  assert.throws(
    () => applyMonthChange(onlyOne, { kind: ChangeKind.REMOVE_CATEGORY, categoryId: 'kids' }),
    InvalidChangeError,
  );
});

test('moving a category puts it before another one, or last', () => {
  const month = new MonthRecord({ month: '2026-11', expenses: [] });
  const order = () => month.categories.map((category) => category.id);
  const move = (categoryId, beforeCategoryId) =>
    applyMonthChange(month, { kind: ChangeKind.MOVE_CATEGORY, categoryId, beforeCategoryId });
  move('other', 'dinner');
  assert.deepEqual(order().slice(0, 3), ['other', 'dinner', 'lunch']);
  move('other', null);
  assert.equal(order().at(-1), 'other');
  move('lunch', 'gone'); // the target was removed meanwhile: goes last
  assert.equal(order().at(-1), 'lunch');
  move('gone', 'dinner'); // moving a removed category does nothing
  move('dinner', 'dinner');
  assert.equal(order().length, 11);
  assert.deepEqual(
    MonthRecord.createFromTemplate(month, '2026-12').categories.map((category) => category.id),
    order(),
  );
});

test('two people moving categories at once both take effect in arrival order', () => {
  const month = new MonthRecord({ month: '2026-11', expenses: [] });
  applyMonthChange(month, { kind: ChangeKind.MOVE_CATEGORY, categoryId: 'travel', beforeCategoryId: 'dinner' });
  applyMonthChange(month, { kind: ChangeKind.MOVE_CATEGORY, categoryId: 'gifts', beforeCategoryId: 'dinner' });
  assert.deepEqual(
    month.categories.slice(0, 3).map((category) => category.id),
    ['travel', 'gifts', 'dinner'],
  );
});
