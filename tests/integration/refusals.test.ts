/** Edits the Worker refuses: the answer says why, and nothing is stored. */
import { beforeEach, expect, test } from 'vitest';

import type { ErrorResponse } from '../../shared/api/endpoints.ts';
import { call, clearHousehold, storedEntries } from './helpers.ts';

const MONTH = '/api/months/2026-11';
const coffee = { id: 'e1', categoryId: 'lunch', amount: 3.5, description: 'coffee', date: '2026-11-03' };

beforeEach(async () => {
  await clearHousehold();
  await call('POST', `${MONTH}/expenses`, coffee); // a month with one expense in Lunch
  await call('POST', `${MONTH}/categories`, { id: 'kids', name: 'Kids' });
});

/** Sends a request that must be refused, and checks that storage didn't change. */
async function expectRefused(status: number, method: string, path: string, body?: unknown) {
  const before = await storedEntries();
  const answer = await call<ErrorResponse>(method, path, body);
  expect(answer.status, `${method} ${path}`).toBe(status);
  expect(await storedEntries()).toEqual(before);
  return answer.body;
}

test('an edit that breaks a rule of the month answers 409 with the rule', async () => {
  const cases: [string, string, unknown, string][] = [
    ['POST', '/expenses', { ...coffee, id: 'e2', categoryId: 'casino' }, 'unknown-category'],
    ['POST', '/expenses', { ...coffee, id: 'e2', date: '2026-12-01' }, 'date-outside-month'],
    // Names are compared ignoring capitals. (Default categories store a translation id, not a
    // name, so the server can't compare with "Lunch"; the page checks those in its language.)
    ['POST', '/categories', { id: 'c1', name: 'kids' }, 'category-name-taken'],
    ['DELETE', '/categories/lunch', undefined, 'category-has-expenses'],
  ];
  for (const [method, path, body, rule] of cases) {
    const answer = await expectRefused(409, method, `${MONTH}${path}`, body);
    expect(answer.rule).toBe(rule);
  }
});

test('a request that does not match its endpoint answers 400', async () => {
  await expectRefused(400, 'POST', `${MONTH}/expenses`, { ...coffee, id: 'e2', amount: 0 });
  await expectRefused(400, 'POST', `${MONTH}/expenses`, { ...coffee, id: 'e2', amount: '5' });
  await expectRefused(400, 'PUT', `${MONTH}/categories/lunch/name`, { name: 'x'.repeat(500) });
  await expectRefused(400, 'POST', '/api/months/2026-13/expenses', coffee);
  await expectRefused(400, 'POST', `${MONTH}/recurring/__proto__`, { id: 'x', name: 'X' });
});

test('an unknown path answers 404', async () => {
  await expectRefused(404, 'GET', '/api/months/2026-11/nothing-here');
  await expectRefused(404, 'PATCH', `${MONTH}/expenses/e1/amount`, { amount: 2 });
});
