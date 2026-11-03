import assert from 'node:assert/strict';
import { test } from 'vitest';

import { MonthRecord } from '../shared/month/month-record.ts';
import {
  InvalidMessageError,
  encodeClientMessage,
  encodeServerMessage,
  parseClientMessage,
  parseServerMessage,
} from '../shared/protocol.ts';

const addCoffee = {
  kind: 'addExpense',
  expense: { id: 'e1', categoryKey: 'lunch', amount: 3.5, description: 'coffee', date: '2026-11-03' },
};

test('every message the page sends can be read by the server', () => {
  const messages = [
    { type: 'openMonth', month: '2026-11' },
    { type: 'change', changeId: 'c1', month: '2026-11', change: addCoffee },
    { type: 'export' },
    { type: 'import', months: [{ month: '2026-11', expenses: [] }] },
  ];
  for (const message of messages) {
    assert.deepEqual(parseClientMessage(encodeClientMessage(message)), message);
  }
});

test('a month the server sends arrives whole, older fields included', () => {
  const month = MonthRecord.createEmpty('2026-11');
  const sent = encodeServerMessage({
    type: 'month',
    month: month.toJSON(),
    monthKeys: ['2026-11'],
    appliedChangeId: 'c1',
  });
  const received = parseServerMessage(sent);
  assert.equal(received.type, 'month');
  assert.deepEqual(received.month, month.toJSON());

  const importedFile = { month: '2024-10', expenses: [], importedFrom: 'spreadsheet' };
  const exported = parseServerMessage(encodeServerMessage({ type: 'exportData', months: [importedFile] }));
  assert.deepEqual(exported, { type: 'exportData', months: [importedFile] });
});

test('messages that do not match the protocol are refused', () => {
  const refusedFromPage = [
    'not json',
    '"openMonth"',
    JSON.stringify({ type: 'deleteEverything' }),
    JSON.stringify({ type: 'openMonth', month: '2026-13' }),
    JSON.stringify({ type: 'openMonth' }),
    JSON.stringify({ type: 'change', changeId: 'x'.repeat(65), month: '2026-11', change: addCoffee }),
    JSON.stringify({ type: 'change', month: '2026-11', change: addCoffee }),
    JSON.stringify({ type: 'import', months: 'everything' }),
  ];
  for (const text of refusedFromPage) {
    assert.throws(() => parseClientMessage(text), InvalidMessageError, text);
  }

  const refusedFromServer = [
    JSON.stringify({ type: 'month', month: { expenses: [] }, monthKeys: [] }),
    JSON.stringify({ type: 'error' }),
    JSON.stringify({ type: 'importDone', count: 'many' }),
  ];
  for (const text of refusedFromServer) {
    assert.throws(() => parseServerMessage(text), InvalidMessageError, text);
  }
});
