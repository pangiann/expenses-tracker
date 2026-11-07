import assert from 'node:assert/strict';
import { test } from 'vitest';

import { DEFAULT_CATEGORIES } from '../shared/month/categories.ts';
import { MonthRecord, MonthRuleError } from '../shared/month/month-record.ts';
import { closestSavedMonthKey, isMonthData } from '../shared/month/month-validation.ts';

/** A month file in the current format: every part present, with these fields on top. */
const monthData = (fields) => ({
  month: fields.month,
  income: { expected: 0, entries: [] },
  categories: DEFAULT_CATEGORIES.map((category) => ({ ...category })),
  budgets: {},
  expenses: [],
  fixed: [],
  subscriptions: [],
  ...fields,
});

const novemberWithRent = () =>
  new MonthRecord(
    monthData({
      month: '2026-11',
      income: { expected: 4000, entries: [] },
      budgets: { dinner: 130 },
      expenses: [],
      fixed: [
        { id: 'rent', name: 'Rent', amount: 1000 },
        { id: 'internet', name: 'Internet', amount: 30 },
      ],
      subscriptions: [],
    }),
  );

const november = () => MonthRecord.createEmptyMonth('2026-11');
const coffee = { id: 'e1', categoryId: 'lunch', amount: 3.5, description: 'coffee', date: '2026-11-03' };
const lesson = { id: 'income-1', amount: 40, description: 'lesson', date: '2026-11-04' };

/** Asserts that the edit throws MonthRuleError for this rule. */
function assertBreaks(rule, edit) {
  assert.throws(edit, (error) => error instanceof MonthRuleError && error.rule === rule, rule);
}

// ----- Expenses and income -----

test('the same edit twice changes the month once (safe to resend)', () => {
  const month = november();
  month.addExpense(coffee);
  month.addExpense(coffee);
  month.addCategory({ id: 'kids', name: 'Kids', color: '#000000' });
  month.addCategory({ id: 'kids', name: 'Kids', color: '#000000' });
  assert.equal(month.expenses.length, 1);
  assert.equal(month.spentInCategory('lunch'), 3.5);
  assert.equal(month.categories.filter((category) => category.id === 'kids').length, 1);
});

test('edits from two people on different expenses both survive', () => {
  const month = november();
  month.addExpense(coffee);
  month.addExpense({ ...coffee, id: 'e2', amount: 12 });
  month.updateExpenseAmount('e1', 4);
  assert.deepEqual(
    month.expenses.map((expense) => expense.amount),
    [4, 12],
  );
});

test('income is a list of entries, and Earned is their total', () => {
  const month = novemberWithRent();
  month.addIncome(lesson);
  month.addIncome({ ...lesson, id: 'income-2', amount: 35.5 });
  month.addIncome(lesson); // resent: no duplicate
  assert.equal(month.totalIncome, 75.5);
  month.updateIncomeAmount('income-2', 45);
  month.removeIncome('income-1');
  assert.equal(month.totalIncome, 45);
  assert.equal(month.calculateTotals().saved, 45 - 1030);
  assert.equal(month.toJSON().income.actual, 45);
});

test('budgets and expected income can be set', () => {
  const month = novemberWithRent();
  month.setBudget('travel', 200);
  month.setExpectedIncome(4200);
  assert.equal(month.budgetFor('travel'), 200);
  assert.equal(month.expectedIncome, 4200);
});

// ----- Fixed costs and subscriptions -----

test('fixed costs are found by id, so edits hit the right row after others are removed', () => {
  const month = novemberWithRent();
  month.removeRecurringCost('fixed', 'rent');
  month.renameRecurringCost('fixed', 'internet', 'Fibre');
  month.setRecurringCostAmount('fixed', 'internet', 35);
  assert.deepEqual(month.recurringCostsIn('fixed'), [{ id: 'internet', name: 'Fibre', amount: 35 }]);
  // Editing a row someone else removed does nothing instead of failing.
  month.renameRecurringCost('fixed', 'rent', 'Flat');
  assert.equal(month.recurringCostsIn('fixed').length, 1);
});

test('adding the same fixed cost twice keeps one row', () => {
  const month = novemberWithRent();
  month.addRecurringCost('subscriptions', { id: 'gym', name: 'Gym' });
  month.addRecurringCost('subscriptions', { id: 'gym', name: 'Gym' });
  assert.equal(month.recurringCostsIn('subscriptions').length, 1);
});

// ----- New months and month files -----

test('a new month copies budgets, expected income and fixed costs, not expenses or income entries', () => {
  const october = novemberWithRent();
  october.addExpense(coffee);
  october.addIncome(lesson);
  const december = MonthRecord.createFromTemplateMonth(october, '2026-12');
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

test('isMonthData accepts month files in the current format and refuses older ones', () => {
  assert.equal(isMonthData(novemberWithRent().toJSON()), true);
  assert.equal(isMonthData(MonthRecord.createEmptyMonth('2026-11').toJSON()), true);
  assert.equal(isMonthData(monthData({ month: '2026-13' })), false);
  assert.equal(isMonthData({ month: '2026-11', expenses: [] }), false);
  assert.equal(isMonthData(null), false);
  // The older format: one income number, no category list, fixed costs without ids.
  const withoutCategories = monthData({ month: '2026-08' });
  delete withoutCategories.categories;
  assert.equal(isMonthData(withoutCategories), false);
  assert.equal(isMonthData(monthData({ month: '2026-08', income: { expected: 4000, actual: 3500 } })), false);
  assert.equal(isMonthData(monthData({ month: '2026-08', fixed: [{ name: 'Rent', amount: 880 }] })), false);
});

test('a month keeps its own category list, and a new month copies it', () => {
  const october = new MonthRecord(
    monthData({
      month: '2026-10',
      expenses: [],
      categories: [
        { id: 'kids', name: 'Kids', color: '#f59e0b' },
        { id: 'other', nameId: 'category.other', color: '#8a92a6' },
      ],
      budgets: { kids: 100, other: 20 },
    }),
  );
  const nextMonth = MonthRecord.createFromTemplateMonth(october, '2026-11');
  assert.deepEqual(
    nextMonth.categories.map((category) => category.id),
    ['kids', 'other'],
  );
  assert.equal(nextMonth.budgetFor('kids'), 100);
  assert.equal(nextMonth.calculateTotals().totalBudgeted, 120);
});

// ----- Rules of the month -----

test('the month refuses edits that break its rules, and names the rule', () => {
  const month = november();
  assertBreaks('unknown-category', () => month.addExpense({ ...coffee, categoryId: 'casino' }));
  assertBreaks('date-outside-month', () => month.addExpense({ ...coffee, date: '2026-12-01' }));
  assertBreaks('date-outside-month', () => month.addIncome({ ...lesson, date: '2026-10-31' }));
  assertBreaks('unknown-category', () => month.setBudget('casino', 10));
  assertBreaks('category-name-empty', () => month.addCategory({ id: 'c1', name: '   ', color: '#000000' }));
  assertBreaks('category-name-too-long', () => month.addCategory({ id: 'c1', name: 'x'.repeat(21), color: '#000000' }));
  assert.equal(month.expenses.length, 0);
  assert.equal(month.categories.length, 11);
});

test('expenses and budgets are refused for a category the month does not have', () => {
  const month = new MonthRecord(
    monthData({
      month: '2026-10',
      expenses: [],
      categories: [{ id: 'kids', name: 'Kids', color: '#f59e0b' }],
    }),
  );
  const groceries = { id: 'e9', categoryId: 'supermarket', amount: 20, description: '', date: '2026-10-02' };
  assertBreaks('unknown-category', () => month.addExpense(groceries));
  assertBreaks('unknown-category', () => month.setBudget('supermarket', 5));
  month.addExpense({ ...groceries, categoryId: 'kids' });
  assert.equal(month.spentInCategory('kids'), 20);
});

// ----- Categories -----

test('adding a category puts it at the end with a budget of 0', () => {
  const month = november();
  month.addCategory({ id: 'kids', name: ' Kids ', color: '#f59e0b' });
  assert.equal(month.categories.length, 12);
  assert.deepEqual(month.categories[11], { id: 'kids', name: 'Kids', color: '#f59e0b' });
  assert.equal(month.budgetFor('kids'), 0);
  month.addExpense({ id: 'e-k', categoryId: 'kids', amount: 15, description: 'toys', date: '2026-11-05' });
  assert.equal(month.spentInCategory('kids'), 15);
  assert.equal(MonthRecord.createFromTemplateMonth(month, '2026-12').findCategory('kids').name, 'Kids');
});

test('a new category gets a colour no other category in the month uses', () => {
  const month = november();
  const firstColor = month.pickCategoryColor();
  month.addCategory({ id: 'a', name: 'A', color: firstColor });
  assert.notEqual(month.pickCategoryColor(), firstColor);
});

test('two categories added at the same moment with the same colour end up with different colours', () => {
  const month = november();
  const sameColor = month.pickCategoryColor();
  month.addCategory({ id: 'kids', name: 'Kids', color: sameColor });
  month.addCategory({ id: 'pets', name: 'Pets', color: sameColor });
  assert.notEqual(month.findCategory('kids').color, month.findCategory('pets').color);
});

test('category names must be unique (ignoring capitals and spaces) and at most 20 characters', () => {
  const month = november();
  const add = (id, name) => month.addCategory({ id, name, color: '#f59e0b' });
  add('kids', 'Kids');
  assertBreaks('category-name-taken', () => add('kids-2', '  KIDS '));
  assertBreaks('category-name-too-long', () => add('long', 'x'.repeat(21)));
  add('twenty', 'x'.repeat(20));
  assert.deepEqual(
    month.categories.slice(11).map((category) => category.id),
    ['kids', 'twenty'],
  );
});

test('a month holds at most 40 categories', () => {
  const month = november();
  for (let number = month.categories.length; number < 40; number++) {
    month.addCategory({ id: `c${number}`, name: `Category ${number}`, color: '#000000' });
  }
  assertBreaks('too-many-categories', () => month.addCategory({ id: 'c41', name: 'One more', color: '#000000' }));
});

test('renaming a category keeps its id, expenses and budget', () => {
  const month = new MonthRecord(monthData({ month: '2026-11', expenses: [], budgets: { dinner: 130 } }));
  month.addExpense({ id: 'e-d', categoryId: 'dinner', amount: 30, description: 'pizza', date: '2026-11-02' });
  month.renameCategory('dinner', ' Eating out ');
  // no nameId any more: the typed name shows in every language
  assert.deepEqual(month.findCategory('dinner'), { id: 'dinner', name: 'Eating out', color: '#e8618c' });
  assert.equal(month.spentInCategory('dinner'), 30);
  assert.equal(month.budgetFor('dinner'), 130);
});

test('renaming follows the name rules, but a category may keep its own name in other capitals', () => {
  const month = november();
  month.addCategory({ id: 'kids', name: 'kids', color: '#f59e0b' });
  month.addCategory({ id: 'pets', name: 'Pets', color: '#ef4444' });
  month.renameCategory('kids', 'Kids');
  assert.equal(month.findCategory('kids').name, 'Kids');
  assertBreaks('category-name-taken', () => month.renameCategory('kids', 'PETS'));
  assertBreaks('category-name-empty', () => month.renameCategory('kids', ''));
  assertBreaks('category-name-too-long', () => month.renameCategory('kids', 'x'.repeat(21)));
  // Renaming a category someone else removed does nothing.
  month.renameCategory('gone', 'Anything');
  assert.equal(month.categories.length, 13);
});

test('an empty category can be removed, with its budget; removing it again does nothing', () => {
  const month = new MonthRecord(monthData({ month: '2026-11', expenses: [], budgets: { gifts: 60 } }));
  month.removeCategory('gifts');
  month.removeCategory('gifts'); // resent
  assert.equal(month.findCategory('gifts'), undefined);
  assert.equal(month.budgets.gifts, undefined);
  assert.equal(month.categories.length, 10);
  assert.equal(MonthRecord.createFromTemplateMonth(month, '2026-12').findCategory('gifts'), undefined);
});

test('a category with expenses, or the last category, cannot be removed', () => {
  const month = november();
  month.addExpense(coffee);
  assert.equal(month.categoryRemovalBlocker('lunch'), 'has-expenses');
  assertBreaks('category-has-expenses', () => month.removeCategory('lunch'));
  assert.ok(month.findCategory('lunch'));

  const onlyOne = new MonthRecord(
    monthData({
      month: '2026-11',
      expenses: [],
      categories: [{ id: 'kids', name: 'Kids', color: '#f59e0b' }],
    }),
  );
  assert.equal(onlyOne.categoryRemovalBlocker('kids'), 'last-category');
  assertBreaks('last-category', () => onlyOne.removeCategory('kids'));
});

test('moving a category puts it before another one, or last', () => {
  const month = november();
  const order = () => month.categories.map((category) => category.id);
  month.moveCategory('other', 'dinner');
  assert.deepEqual(order().slice(0, 3), ['other', 'dinner', 'lunch']);
  month.moveCategory('other', null);
  assert.equal(order().at(-1), 'other');
  month.moveCategory('lunch', 'gone'); // the target was removed meanwhile: goes last
  assert.equal(order().at(-1), 'lunch');
  month.moveCategory('gone', 'dinner'); // moving a removed category does nothing
  month.moveCategory('dinner', 'dinner');
  assert.equal(order().length, 11);
  assert.deepEqual(
    MonthRecord.createFromTemplateMonth(month, '2026-12').categories.map((category) => category.id),
    order(),
  );
});

test('two people moving categories at once both take effect in arrival order', () => {
  const month = november();
  month.moveCategory('travel', 'dinner');
  month.moveCategory('gifts', 'dinner');
  assert.deepEqual(
    month.categories.slice(0, 3).map((category) => category.id),
    ['travel', 'gifts', 'dinner'],
  );
});
