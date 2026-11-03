import assert from 'node:assert/strict';
import { afterEach, beforeEach, test, vi } from 'vitest';

/** The browser features the outbox uses, faked: localStorage, window events and fetch. */
let storedItems;
let serverIsReachable;
let requestsSeen;

beforeEach(() => {
  storedItems = new Map();
  serverIsReachable = true;
  requestsSeen = [];
  vi.stubGlobal('localStorage', {
    getItem: (key) => storedItems.get(key) ?? null,
    setItem: (key, value) => storedItems.set(key, value),
    removeItem: (key) => storedItems.delete(key),
  });
  vi.stubGlobal('window', { addEventListener: () => {} });
  vi.stubGlobal('fetch', async (path, { method, body }) => {
    if (!serverIsReachable) throw new TypeError('Failed to fetch');
    requestsSeen.push(`${method} ${path}`);
    if (path.endsWith('/categories/lunch')) {
      return Response.json({ error: 'Month rule broken', rule: 'category-has-expenses' }, { status: 409 });
    }
    return Response.json({ month: { month: '2026-11', sent: JSON.parse(body ?? 'null') }, monthKeys: [], revision: 1 });
  });
});

afterEach(() => vi.unstubAllGlobals());

async function newOutbox() {
  vi.resetModules(); // a fresh outbox that reads localStorage again, like a reloaded page
  const { Outbox } = await import('../web/scripts/api/outbox.ts');
  const outbox = new Outbox();
  const answers = [];
  const states = [];
  outbox.onAnswer = (answer) => answers.push(answer.month.sent);
  outbox.onStateChange = (state) => states.push(state.kind);
  return { outbox, answers, states };
}

const until = async (condition) => {
  for (let attempt = 0; attempt < 100 && !condition(); attempt++) await new Promise((r) => setTimeout(r, 5));
  assert.ok(condition(), 'timed out');
};

const coffee = { id: 'e1', categoryId: 'lunch', amount: 3.5, description: 'coffee', date: '2026-11-03' };

test('edits are sent in the order they were made, and every answer is shown', async () => {
  const { outbox, answers, states } = await newOutbox();
  outbox.send('addExpense', { month: '2026-11' }, coffee);
  outbox.send('changeExpenseAmount', { month: '2026-11', id: 'e1' }, { amount: 4 });
  await until(() => states.at(-1) === 'idle');
  assert.deepEqual(requestsSeen, ['POST /api/months/2026-11/expenses', 'PUT /api/months/2026-11/expenses/e1/amount']);
  assert.deepEqual(answers, [{ ...coffee }, { amount: 4 }]);
  assert.equal(storedItems.size, 0, 'nothing left waiting');
});

test('an edit that does not match its endpoint is refused before sending', async () => {
  const { outbox } = await newOutbox();
  const { InvalidRequestError } = await import('../web/scripts/api/http.ts');
  assert.throws(
    () => outbox.send('addExpense', { month: '2026-11' }, { ...coffee, amount: null }),
    InvalidRequestError,
  );
  assert.equal(outbox.waitingCount, 0);
});

test('without a connection, edits wait, survive a reload, and are sent when it is back', async () => {
  serverIsReachable = false;
  const first = await newOutbox();
  first.outbox.send('addExpense', { month: '2026-11' }, coffee);
  await until(() => first.states.at(-1) === 'offline');
  assert.equal(JSON.parse(storedItems.get('expenses.outbox')).length, 1);

  serverIsReachable = true;
  const reloaded = await newOutbox(); // the tab was closed and opened again
  reloaded.outbox.start();
  await until(() => reloaded.states.at(-1) === 'idle');
  assert.deepEqual(requestsSeen, ['POST /api/months/2026-11/expenses']);
  assert.deepEqual(reloaded.answers, [{ ...coffee }]);
});

test('an edit the server refuses is dropped, and the next one is still sent', async () => {
  const { outbox, states } = await newOutbox();
  outbox.send('removeCategory', { month: '2026-11', id: 'lunch' }, undefined);
  outbox.send('changeExpectedIncome', { month: '2026-11' }, { amount: 3000 });
  await until(() => states.at(-1) === 'idle');
  assert.ok(states.includes('refused'));
  assert.deepEqual(requestsSeen, [
    'DELETE /api/months/2026-11/categories/lunch',
    'PUT /api/months/2026-11/expected-income',
  ]);
  assert.equal(outbox.waitingCount, 0);
});
