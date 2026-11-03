import assert from 'node:assert/strict';
import { test } from 'vitest';

import { MonthRecord, MonthRuleError } from '../shared/month/month-record.ts';

const november = () => MonthRecord.createEmpty('2026-11');
const coffee = { id: 'e1', categoryId: 'lunch', amount: 3.5, description: 'coffee', date: '2026-11-03' };

/** Asserts that the edit throws MonthRuleError for this rule. */
function assertBreaks(rule, edit) {
  assert.throws(edit, (error) => error instanceof MonthRuleError && error.rule === rule, rule);
}

test('the month refuses edits that break its rules, and names the rule', () => {
  const month = november();
  assertBreaks('unknown-category', () => month.addExpense({ ...coffee, categoryId: 'casino' }));
  assertBreaks('date-outside-month', () => month.addExpense({ ...coffee, date: '2026-12-01' }));
  assertBreaks('date-outside-month', () =>
    month.addIncome({ id: 'i1', amount: 40, description: '', date: '2026-10-31' }),
  );
  assertBreaks('unknown-category', () => month.setBudget('casino', 10));
  assertBreaks('category-name-empty', () => month.addCategory({ id: 'c1', name: '   ', color: '#000000' }));
  assertBreaks('category-name-too-long', () => month.addCategory({ id: 'c1', name: 'x'.repeat(21), color: '#000000' }));
  assert.equal(month.expenses.length, 0);
});

test('category names must be unique, ignoring capitals and spaces', () => {
  const month = november();
  month.addCategory({ id: 'kids', name: 'Kids', color: '#000000' });
  assertBreaks('category-name-taken', () => month.addCategory({ id: 'kids-2', name: ' KIDS ', color: '#000000' }));
  month.addCategory({ id: 'pets', name: 'Pets', color: '#000000' });
  assertBreaks('category-name-taken', () => month.renameCategory('pets', 'kids'));
  month.renameCategory('kids', 'KIDS'); // a category may keep its own name
  assert.equal(month.findCategory('kids').name, 'KIDS');
});

test('only an empty category that is not the last one can be removed', () => {
  const month = november();
  month.addExpense(coffee);
  assertBreaks('category-has-expenses', () => month.removeCategory('lunch'));

  const single = new MonthRecord({
    month: '2026-11',
    categories: [{ id: 'only', name: 'Only', color: '#000000' }],
    expenses: [],
  });
  assertBreaks('last-category', () => single.removeCategory('only'));
  single.removeCategory('gone'); // already removed: nothing to do
});

test('a month holds at most 40 categories', () => {
  const month = november();
  for (let number = month.categories.length; number < 40; number++) {
    month.addCategory({ id: `c${number}`, name: `Category ${number}`, color: '#000000' });
  }
  assertBreaks('too-many-categories', () => month.addCategory({ id: 'c41', name: 'One more', color: '#000000' }));
});

test('the same edit twice changes the month once', () => {
  const month = november();
  month.addExpense(coffee);
  month.addExpense(coffee);
  month.addCategory({ id: 'kids', name: 'Kids', color: '#000000' });
  month.addCategory({ id: 'kids', name: 'Kids', color: '#000000' });
  assert.equal(month.expenses.length, 1);
  assert.equal(month.categories.filter((category) => category.id === 'kids').length, 1);
});
