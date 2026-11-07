import assert from 'node:assert/strict';
import { test } from 'vitest';

import { endpoints, readPathParamsIfPathMatches, buildRequestPath } from '../shared/api/endpoints.ts';

/** A sample value for each path parameter. */
const SAMPLE_PARAMS = { month: '2026-11', id: 'item-1', list: 'fixed' };

test('every endpoint matches only its own requests', () => {
  for (const [name, endpoint] of Object.entries(endpoints)) {
    const requestPath = buildRequestPath(endpoint.path, SAMPLE_PARAMS);
    const matching = Object.entries(endpoints)
      .filter(([, other]) => other.method === endpoint.method && readPathParamsIfPathMatches(other.path, requestPath))
      .map(([otherName]) => otherName);
    assert.deepEqual(matching, [name], `${endpoint.method} ${requestPath}`);
  }
});

test('path parameters are filled in and read back', () => {
  const path = buildRequestPath(endpoints.removeExpense.path, { month: '2026-11', id: 'a b/c' });
  assert.equal(path, '/api/months/2026-11/expenses/a%20b%2Fc');
  assert.deepEqual(readPathParamsIfPathMatches(endpoints.removeExpense.path, path), { month: '2026-11', id: 'a b/c' });
  assert.equal(readPathParamsIfPathMatches(endpoints.removeExpense.path, '/api/months/2026-11/expenses'), null);
  assert.equal(readPathParamsIfPathMatches(endpoints.removeExpense.path, '/api/months/2026-11/expenses/%E0'), null);
});

test('request bodies are checked against the endpoint', () => {
  const coffee = { id: 'e1', categoryId: 'lunch', amount: 3.5, date: '2026-11-03' };
  assert.deepEqual(endpoints.addExpense.body.parse(coffee), { ...coffee, description: '' });
  assert.equal(endpoints.addExpense.body.safeParse({ ...coffee, amount: 0 }).success, false);
  assert.equal(endpoints.removeExpense.body.safeParse(undefined).success, true);
  assert.equal(endpoints.getMonth.params.safeParse({ month: '2026-13' }).success, false);
  assert.equal(endpoints.addRecurringCost.params.safeParse({ month: '2026-11', list: '__proto__' }).success, false);
});

test('malformed edits are refused by their endpoint', () => {
  const coffee = { id: 'e1', categoryId: 'lunch', amount: 3.5, description: 'coffee', date: '2026-11-03' };
  const refused = [
    ['addExpense', { ...coffee, amount: -5 }],
    ['addExpense', { ...coffee, amount: '5' }],
    ['addExpense', { ...coffee, amount: Number.POSITIVE_INFINITY }],
    ['addExpense', { ...coffee, description: 'x'.repeat(500) }],
    ['addExpense', { ...coffee, date: 'tomorrow' }],
    ['addExpense', { ...coffee, id: '' }],
    ['addIncome', { id: 'i1', amount: 0, date: '2026-11-04' }],
    ['changeBudget', { amount: Number.NaN }],
    ['addCategory', { id: 'x', name: '  ', color: '#f59e0b' }],
    ['addCategory', { id: 'x', name: 'X', color: 'red' }],
    ['addCategory', { id: 'x', name: 'X', color: '#f59e0b"><script>' }],
    ['moveCategory', {}],
    ['addRecurringCost', { id: 'x', name: '   ' }],
  ];
  for (const [name, body] of refused) {
    assert.equal(endpoints[name].body.safeParse(body).success, false, `${name} ${JSON.stringify(body)}`);
  }
  const withoutDescription = endpoints.addIncome.body.parse({
    id: 'i1',
    amount: 40,
    description: null,
    date: '2026-11-04',
  });
  assert.equal(withoutDescription.description, '');
});
