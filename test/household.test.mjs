import assert from 'node:assert/strict';
import { test } from 'vitest';

import { Broadcaster } from '../worker/household/broadcaster.ts';
import { MonthRepository } from '../worker/household/month-repository.ts';
import { routeRequest } from '../worker/household/router.ts';

/** Durable Object storage kept in a Map. */
function fakeStorage() {
  const entries = new Map();
  return {
    entries,
    async get(key) {
      return structuredClone(entries.get(key));
    },
    async put(keyOrEntries, value) {
      const newEntries = typeof keyOrEntries === 'string' ? { [keyOrEntries]: value } : keyOrEntries;
      for (const [key, entry] of Object.entries(newEntries)) entries.set(key, structuredClone(entry));
    },
    async list({ prefix }) {
      const keys = [...entries.keys()].filter((key) => key.startsWith(prefix)).sort();
      return new Map(keys.map((key) => [key, structuredClone(entries.get(key))]));
    },
  };
}

/** A device's WebSocket that records what it was sent. */
function fakeSocket() {
  let attachment = null;
  return {
    sent: [],
    send(message) {
      this.sent.push(JSON.parse(message));
    },
    serializeAttachment(value) {
      attachment = structuredClone(value);
    },
    deserializeAttachment() {
      return attachment;
    },
  };
}

function fakeHousehold() {
  const sockets = [];
  const state = { acceptWebSocket: (socket) => sockets.push(socket), getWebSockets: () => sockets };
  const storage = fakeStorage();
  return { storage, household: { months: new MonthRepository(storage), broadcaster: new Broadcaster(state) } };
}

/** Calls the endpoint like the page does, and returns the status and the parsed answer. */
async function call(household, method, path, body) {
  const request = new Request(`http://localhost${path}`, {
    method,
    headers: { 'Content-Type': 'application/json' },
    body: body === undefined ? undefined : typeof body === 'string' ? body : JSON.stringify(body),
  });
  const response = await routeRequest(request, household);
  return { status: response.status, answer: await response.json() };
}

const coffee = { id: 'e1', categoryId: 'lunch', amount: 3.5, description: 'coffee', date: '2026-11-03' };

test('getting a month that does not exist creates and saves it', async () => {
  const { household, storage } = fakeHousehold();
  const { status, answer } = await call(household, 'GET', '/api/months/2026-11');
  assert.equal(status, 200);
  assert.equal(answer.month.month, '2026-11');
  assert.deepEqual(answer.monthKeys, ['2026-11']);
  assert.equal(answer.revision, 1);
  assert.ok(storage.entries.has('month:2026-11'));
});

test('adding an expense saves it, answers with the month and updates the devices showing it', async () => {
  const { household, storage } = fakeHousehold();
  const [novemberDevice, octoberDevice] = [fakeSocket(), fakeSocket()];
  household.broadcaster.accept(novemberDevice);
  household.broadcaster.accept(octoberDevice);
  household.broadcaster.watch(novemberDevice, '2026-11');
  household.broadcaster.watch(octoberDevice, '2026-10');

  const { status, answer } = await call(household, 'POST', '/api/months/2026-11/expenses', coffee);
  assert.equal(status, 200);
  assert.deepEqual(
    answer.month.expenses.map((expense) => expense.description),
    ['coffee'],
  );
  assert.equal(storage.entries.get('month:2026-11').expenses.length, 1);
  assert.deepEqual(novemberDevice.sent, [{ type: 'month', ...answer }]);
  assert.deepEqual(octoberDevice.sent, []);

  const resent = await call(household, 'POST', '/api/months/2026-11/expenses', coffee);
  assert.equal(resent.answer.month.expenses.length, 1, 'the same expense sent twice is added once');
  assert.ok(resent.answer.revision > answer.revision);
});

test('every kind of edit goes through its own endpoint', async () => {
  const { household } = fakeHousehold();
  const month = '/api/months/2026-11';
  await call(household, 'POST', `${month}/expenses`, coffee);
  await call(household, 'PUT', `${month}/expenses/e1/amount`, { amount: 4 });
  await call(household, 'POST', `${month}/income`, { id: 'i1', amount: 40, date: '2026-11-04' });
  await call(household, 'PUT', `${month}/expected-income`, { amount: 3000 });
  await call(household, 'POST', `${month}/categories`, { id: 'kids', name: 'Kids', color: '#123456' });
  await call(household, 'PUT', `${month}/categories/kids/name`, { name: 'Children' });
  await call(household, 'PUT', `${month}/categories/kids/position`, { beforeCategoryId: 'dinner' });
  await call(household, 'PUT', `${month}/categories/kids/budget`, { amount: 120 });
  await call(household, 'POST', `${month}/recurring/subscriptions`, { id: 's1', name: 'Music' });
  await call(household, 'PUT', `${month}/recurring/subscriptions/s1/amount`, { amount: 11 });
  const { status, answer } = await call(household, 'PUT', `${month}/recurring/subscriptions/s1/name`, {
    name: 'Radio',
  });

  assert.equal(status, 200);
  assert.equal(answer.month.expenses[0].amount, 4);
  assert.equal(answer.month.income.actual, 40);
  assert.equal(answer.month.income.expected, 3000);
  assert.deepEqual(answer.month.categories[0], { id: 'kids', name: 'Children', color: '#123456' });
  assert.equal(answer.month.budgets.kids, 120);
  assert.deepEqual(answer.month.subscriptions, [{ id: 's1', name: 'Radio', amount: 11 }]);

  await call(household, 'DELETE', `${month}/expenses/e1`);
  await call(household, 'DELETE', `${month}/income/i1`);
  await call(household, 'DELETE', `${month}/categories/kids`);
  const removed = await call(household, 'DELETE', `${month}/recurring/subscriptions/s1`);
  assert.equal(removed.answer.month.expenses.length, 0);
  assert.equal(removed.answer.month.income.entries.length, 0);
  assert.equal(
    removed.answer.month.categories.find((category) => category.id === 'kids'),
    undefined,
  );
  assert.equal(removed.answer.month.subscriptions.length, 0);
});

test('requests that do not match an endpoint, or break a rule, are refused and change nothing', async () => {
  const { household, storage } = fakeHousehold();
  await call(household, 'POST', '/api/months/2026-11/expenses', coffee);
  const before = structuredClone(storage.entries.get('month:2026-11'));

  const refused = [
    [404, 'GET', '/api/months/2026-11/everything'],
    [404, 'PATCH', '/api/months/2026-11/expenses/e1'],
    [400, 'GET', '/api/months/2026-13'],
    [400, 'POST', '/api/months/2026-11/expenses', { ...coffee, amount: -1 }],
    [400, 'POST', '/api/months/2026-11/expenses', 'not json'],
    [400, 'POST', '/api/months/2026-11/recurring/__proto__', { id: 'x', name: 'x' }],
    [409, 'POST', '/api/months/2026-11/expenses', { ...coffee, id: 'e2', categoryId: 'casino' }],
    [409, 'DELETE', '/api/months/2026-11/categories/lunch'],
  ];
  for (const [expectedStatus, method, path, body] of refused) {
    const { status, answer } = await call(household, method, path, body);
    assert.equal(status, expectedStatus, `${method} ${path}`);
    assert.equal(typeof answer.error, 'string');
  }
  const ruleBroken = await call(household, 'DELETE', '/api/months/2026-11/categories/lunch');
  assert.equal(ruleBroken.answer.rule, 'category-has-expenses');
  assert.deepEqual(storage.entries.get('month:2026-11'), before);
});

test('a new month copies categories and budgets from the closest earlier month', async () => {
  const { household } = fakeHousehold();
  await call(household, 'POST', '/api/months/2026-10/categories', { id: 'kids', name: 'Kids', color: '#123456' });
  await call(household, 'PUT', '/api/months/2026-10/categories/kids/budget', { amount: 50 });
  const { answer } = await call(household, 'GET', '/api/months/2026-11');
  assert.ok(answer.month.categories.some((category) => category.id === 'kids'));
  assert.equal(answer.month.budgets.kids, 50);
  assert.deepEqual(answer.monthKeys, ['2026-10', '2026-11']);
});

test('a backup can be imported and exported', async () => {
  const { household } = fakeHousehold();
  const months = [
    { month: '2024-10', expenses: [], importedFrom: 'spreadsheet' },
    { month: '2024-11', expenses: [] },
  ];
  const imported = await call(household, 'POST', '/api/import', { months });
  assert.deepEqual(imported, { status: 200, answer: { count: 2 } });

  const { answer } = await call(household, 'GET', '/api/export');
  assert.deepEqual(
    answer.months.map((month) => month.month),
    ['2024-10', '2024-11'],
  );
  assert.equal(answer.months[0].importedFrom, 'spreadsheet');

  const notABackup = await call(household, 'POST', '/api/import', { months: [{ month: 'soon' }] });
  assert.equal(notABackup.status, 400);
});
