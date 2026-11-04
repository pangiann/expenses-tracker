import assert from 'node:assert/strict';
import { test } from 'vitest';

import { MonthRecord } from '../shared/month/month-record.ts';
import {
  InvalidMessageError,
  encodeClientMessage,
  encodeServerMessage,
  parseClientMessage,
  parseServerMessage,
} from '../shared/live-update-messages.ts';

test('the page says which month it shows, and the household sends that month', () => {
  const watch = { type: 'watchMonth', month: '2026-11' };
  assert.deepEqual(parseClientMessage(encodeClientMessage(watch)), watch);

  const month = MonthRecord.createEmpty('2026-11').toJSON();
  const update = { type: 'month', month, monthKeys: ['2026-11'], revision: 7 };
  assert.deepEqual(parseServerMessage(encodeServerMessage(update)), update);
});

test('messages that do not match the protocol are refused', () => {
  const refusedFromPage = [
    'not json',
    '"watchMonth"',
    JSON.stringify({ type: 'change', changeId: 'c1', month: '2026-11', change: {} }), // edits are HTTP requests now
    JSON.stringify({ type: 'watchMonth', month: '2026-13' }),
    JSON.stringify({ type: 'watchMonth' }),
  ];
  for (const text of refusedFromPage) {
    assert.throws(() => parseClientMessage(text), InvalidMessageError, text);
  }

  const refusedFromServer = [
    JSON.stringify({ type: 'month', month: { expenses: [] }, monthKeys: [], revision: 1 }),
    JSON.stringify({ type: 'month', month: { month: '2026-11', expenses: [] }, monthKeys: [] }),
    JSON.stringify({ type: 'error', message: 'old message type' }),
  ];
  for (const text of refusedFromServer) {
    assert.throws(() => parseServerMessage(text), InvalidMessageError, text);
  }
});
