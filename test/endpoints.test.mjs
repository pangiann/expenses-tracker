import assert from 'node:assert/strict';
import { test } from 'vitest';

import { endpoints, matchPath, pathFor } from '../shared/api/endpoints.ts';

/** A sample value for each path parameter. */
const SAMPLE_PARAMS = { month: '2026-11', id: 'item-1', list: 'fixed' };

test('every endpoint matches only its own requests', () => {
  for (const [name, endpoint] of Object.entries(endpoints)) {
    const requestPath = pathFor(endpoint.path, SAMPLE_PARAMS);
    const matching = Object.entries(endpoints)
      .filter(([, other]) => other.method === endpoint.method && matchPath(other.path, requestPath))
      .map(([otherName]) => otherName);
    assert.deepEqual(matching, [name], `${endpoint.method} ${requestPath}`);
  }
});

test('path parameters are filled in and read back', () => {
  const path = pathFor(endpoints.removeExpense.path, { month: '2026-11', id: 'a b/c' });
  assert.equal(path, '/api/months/2026-11/expenses/a%20b%2Fc');
  assert.deepEqual(matchPath(endpoints.removeExpense.path, path), { month: '2026-11', id: 'a b/c' });
  assert.equal(matchPath(endpoints.removeExpense.path, '/api/months/2026-11/expenses'), null);
  assert.equal(matchPath(endpoints.removeExpense.path, '/api/months/2026-11/expenses/%E0'), null);
});

test('request bodies are checked against the endpoint', () => {
  const coffee = { id: 'e1', categoryId: 'lunch', amount: 3.5, date: '2026-11-03' };
  assert.deepEqual(endpoints.addExpense.body.parse(coffee), { ...coffee, description: '' });
  assert.equal(endpoints.addExpense.body.safeParse({ ...coffee, amount: 0 }).success, false);
  assert.equal(endpoints.removeExpense.body.safeParse(undefined).success, true);
  assert.equal(endpoints.getMonth.params.safeParse({ month: '2026-13' }).success, false);
  assert.equal(endpoints.addRecurringCost.params.safeParse({ month: '2026-11', list: '__proto__' }).success, false);
});
